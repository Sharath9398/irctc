const CONFIG = require('../config/config');

class IRCTCService {
    constructor(connection) {
        this.connection = connection;
        this.sessionData = {
            cookies: null,
            tokens: {
                bearer: null,
                bmiyek: null,
                greq: null,
                csrf: null
            }
        };
    }

    async testHandshake() {
        try {
            console.log('Testing IRCTC handshake...');
            
            const mainPageResponse = await this.connection.client.get(`${CONFIG.irctc.baseUrl}/nget/train-search`);
            console.log('Main page status:', mainPageResponse.status);
            
            const captchaResponse = await this.connection.client.get(`${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginCaptcha`, {
                responseType: 'arraybuffer'
            });
            console.log('Captcha status:', captchaResponse.status);
            
            console.log('IRCTC handshake successful');
            return { success: true };
            
        } catch (error) {
            console.log('IRCTC handshake failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getCaptcha() {
        try {
            console.log('Fetching login captcha...');
            
            const headers = {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9',
                'bmirak': 'webbm',
                'Content-Language': 'en',
                'Content-Type': 'application/x-www-form-urlencoded',
                'DNT': '1',
                'greq': Date.now().toString(),
                'Priority': 'u=1, i',
                'Referer': 'https://www.irctc.co.in/nget/train-search',
                'Sec-CH-UA': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
            };
            
            const response = await this.connection.client.get(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginCaptcha`,
                { headers }
            );
            
            if (response.headers['set-cookie']) {
                this.sessionData.cookies = response.headers['set-cookie'];
            }
            
            const captchaData = response.data;
            if (captchaData && captchaData.captchaQuestion) {
                return {
                    success: true,
                    captchaImage: captchaData.captchaQuestion,
                    captchaTime: captchaData.captchaTime,
                    status: captchaData.status,
                    cookies: response.headers['set-cookie']
                };
            } else {
                return {
                    success: false,
                    error: 'No captcha question in response',
                    response: captchaData
                };
            }
            
        } catch (error) {
            console.error('Failed to fetch captcha:', error.message);
            return { success: false, error: error.message };
        }
    }

    async performLogin(captchaSolution = null) {
        try {
            console.log('Starting IRCTC login flow...');
            
            // Step 1: Get captcha
            const captchaResult = await this.getCaptcha();
            if (!captchaResult.success) {
                return captchaResult;
            }

            // Step 2: Auto-solve captcha using OCR
            let finalCaptchaSolution = captchaSolution;
            
            // Always save captcha for debugging
            const fs = require('fs');
            fs.writeFileSync('captcha.png', Buffer.from(captchaResult.captchaImage, 'base64'));
            console.log('Captcha saved as captcha.png');
            
            if (!finalCaptchaSolution) {
                console.log('Attempting to solve captcha automatically...');
                const CaptchaSolver = require('./captcha-solver');
                const solver = new CaptchaSolver();
                
                const solveResult = await solver.solveCaptcha(captchaResult.captchaImage);
                await solver.terminate();
                
                if (solveResult.success) {
                    finalCaptchaSolution = solveResult.text;
                    console.log('Captcha auto-solved successfully');
                } else {
                    console.log('Auto-solve failed, trying external API...');
                    
                    const apiResult = await this.solveWithExternalAPI(captchaResult.captchaImage);
                    if (apiResult.success) {
                        finalCaptchaSolution = apiResult.text;
                        console.log('Captcha solved via external API!');
                    } else {
                        return {
                            success: false,
                            requiresCaptcha: true,
                            captchaImage: captchaResult.captchaImage,
                            message: 'Captcha solving failed. Manual solving required.'
                        };
                    }
                }
            }

            // Step 3: Submit login with credentials and captcha
            return await this.submitLogin(CONFIG.irctc.username, CONFIG.irctc.password, finalCaptchaSolution);
            
        } catch (error) {
            console.error('Login flow error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async submitLogin(username, password, captcha) {
        try {
            console.log('Submitting login credentials...');
            
            const loginPayload = {
                userId: username,
                password: password,
                captcha: captcha
            };

            const headers = {
                'Accept': 'application/json, text/plain, */*',
                'bmirak': 'webbm',
                'Content-Type': 'application/json',
                'greq': Date.now().toString(),
                'Origin': CONFIG.irctc.baseUrl,
                'Referer': `${CONFIG.irctc.baseUrl}/nget/train-search`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            };

            // Add cookies from captcha request
            if (this.sessionData.cookies) {
                headers['Cookie'] = this.sessionData.cookies.join('; ');
            }

            const response = await this.connection.client.post(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginAction`,
                loginPayload,
                { headers }
            );

            // Check login response
            if (response.data) {
                if (response.data.success || response.status === 200) {
                    console.log('Login successful!');
                    
                    // Extract and store authentication tokens
                    await this.extractTokens(response);
                    
                    return {
                        success: true,
                        message: 'Login successful',
                        tokens: this.sessionData.tokens,
                        userData: response.data
                    };
                } else {
                    console.log('Login failed:', response.data.message || 'Invalid credentials');
                    return {
                        success: false,
                        error: response.data.message || 'Login failed - check credentials or captcha'
                    };
                }
            }

            return { success: false, error: 'No response data received' };
            
        } catch (error) {
            console.error('Login submission error:', error.message);
            
            // Handle specific error cases
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 400) {
                    return { success: false, error: 'Invalid captcha or credentials' };
                } else if (status === 401) {
                    return { success: false, error: 'Authentication failed' };
                } else if (status === 429) {
                    return { success: false, error: 'Too many requests - please wait' };
                }
                
                return { success: false, error: data?.message || `HTTP ${status} error` };
            }
            
            return { success: false, error: error.message };
        }
    }

    async extractTokens(response) {
        try {
            // Extract tokens from response headers and body
            const headers = response.headers;
            
            // Bearer token (usually in response body)
            if (response.data && response.data.token) {
                this.sessionData.tokens.bearer = response.data.token;
            }
            
            // Extract other tokens from headers
            if (headers['bmiyek']) {
                this.sessionData.tokens.bmiyek = headers['bmiyek'];
            }
            
            if (headers['greq']) {
                this.sessionData.tokens.greq = headers['greq'];
            }
            
            if (headers['spa-csrf-token']) {
                this.sessionData.tokens.csrf = headers['spa-csrf-token'];
            }
            
            // Update cookies
            if (headers['set-cookie']) {
                this.sessionData.cookies = [...(this.sessionData.cookies || []), ...headers['set-cookie']];
            }
            
            console.log('Authentication tokens extracted');
            
        } catch (error) {
            console.error('Token extraction error:', error.message);
        }
    }

    async validateSession() {
        try {
            console.log('Validating session...');
            
            const headers = {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json; charset=UTF-8'
            };
            
            // Add authentication headers
            if (this.sessionData.tokens.bearer) {
                headers['Authorization'] = `Bearer ${this.sessionData.tokens.bearer}`;
            }
            
            if (this.sessionData.tokens.bmiyek) {
                headers['bmiyek'] = this.sessionData.tokens.bmiyek;
            }
            
            if (this.sessionData.tokens.greq) {
                headers['greq'] = this.sessionData.tokens.greq;
            }
            
            if (this.sessionData.tokens.csrf) {
                headers['spa-csrf-token'] = this.sessionData.tokens.csrf;
            }
            
            if (this.sessionData.cookies) {
                headers['Cookie'] = this.sessionData.cookies.join('; ');
            }

            const response = await this.connection.client.get(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/validateUser?source=3`,
                { headers }
            );

            if (response.status === 200) {
                console.log('Session is valid');
                return { success: true, valid: true };
            }
            
            return { success: false, valid: false, error: 'Session invalid' };
            
        } catch (error) {
            console.error('Session validation error:', error.message);
            return { success: false, valid: false, error: error.message };
        }
    }

    getSessionInfo() {
        return {
            hasTokens: Object.values(this.sessionData.tokens).some(token => token !== null),
            hasCookies: this.sessionData.cookies !== null,
            tokens: this.sessionData.tokens
        };
    }

    clearSession() {
        this.sessionData = {
            cookies: null,
            tokens: {
                bearer: null,
                bmiyek: null,
                greq: null,
                csrf: null
            }
        };
        console.log('Session data cleared');
    }

    async solveWithExternalAPI(base64Image) {
        try {
            console.log('Using external captcha API...');
            
            const response = await this.connection.client.post(
                'https://api.verifyotp.xyz/api/solve',
                { imageContent: base64Image },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Auth-Token': 'BOOK_TOKEN_HERE'
                    }
                }
            );
            
            if (response.data && response.data.text) {
                return { success: true, text: response.data.text };
            }
            
            return { success: false, error: 'No text in API response' };
        } catch (error) {
            console.error('External API error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async searchTrains(searchParams) {
        try {
            console.log('Searching trains...');
            
            const payload = {
                concessionBooking: false,
                srcStn: searchParams.fromStation,
                destStn: searchParams.toStation,
                jrnyClass: searchParams.travelClass,
                jrnyDate: searchParams.journeyDate,
                quotaCode: searchParams.quota || 'GN',
                ticketType: 'E',
                currentBooking: 'false',
                flexiFlag: false,
                ftBooking: false,
                handicapFlag: false,
                loyaltyRedemptionBooking: false
            };
            
            const headers = {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json; charset=UTF-8',
                'bmirak': 'webbm',
                'X-Requested-With': 'XMLHttpRequest'
            };
            
            // Add authentication headers
            if (this.sessionData.tokens.bearer) {
                headers['Authorization'] = `Bearer ${this.sessionData.tokens.bearer}`;
            }
            if (this.sessionData.tokens.bmiyek) {
                headers['bmiyek'] = this.sessionData.tokens.bmiyek;
            }
            if (this.sessionData.tokens.greq) {
                headers['greq'] = this.sessionData.tokens.greq;
            }
            if (this.sessionData.tokens.csrf) {
                headers['spa-csrf-token'] = this.sessionData.tokens.csrf;
            }
            if (this.sessionData.cookies) {
                headers['Cookie'] = this.sessionData.cookies.join('; ');
            }
            
            const response = await this.connection.client.post(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/altAvlEnq/TC`,
                payload,
                { headers }
            );
            
            if (response.data) {
                console.log('Train search successful');
                return { success: true, trains: response.data };
            }
            
            return { success: false, error: 'No train data received' };
            
        } catch (error) {
            console.error('Train search error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async solveCaptchaFromFile(imagePath) {
        try {
            console.log('Solving captcha from file:', imagePath);
            const CaptchaSolver = require('./captcha-solver');
            const solver = new CaptchaSolver();
            const fs = require('fs');
            
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            const result = await solver.solveCaptcha(base64Image);
            await solver.terminate();
            
            return result;
        } catch (error) {
            console.error('Captcha solving error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = IRCTCService;