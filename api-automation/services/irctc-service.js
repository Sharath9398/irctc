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
            console.log('Starting IRCTC browser login flow...');
            
            // Step 1: Get tokens via browser automation
            const browserResult = await this.getBrowserTokens(
                CONFIG.irctc.username, 
                CONFIG.irctc.password, 
                captchaSolution
            );
            
            if (!browserResult.success) {
                return browserResult;
            }
            
            // Step 2: Authenticate with extracted tokens
            return await this.authenticateWithTokens(
                browserResult.tokens.bearer,
                browserResult.tokens.bmiyek,
                browserResult.tokens.greq,
                browserResult.tokens.csrf
            );
            
        } catch (error) {
            console.error('Login flow error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getBrowserTokens(username, password, captchaSolution) {
        const { Builder, By, until } = require('selenium-webdriver');
        const chrome = require('selenium-webdriver/chrome');
        
        let driver;
        try {
            console.log('Starting browser to get IRCTC tokens...');
            
            const options = new chrome.Options();
            options.addArguments('--disable-blink-features=AutomationControlled');
            options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            options.addArguments('--incognito');
            options.addArguments('--disable-web-security');
            options.addArguments('--disable-features=VizDisplayCompositor');
            
            driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();
            
            // Navigate to IRCTC
            await driver.get('https://www.irctc.co.in/nget/train-search');
            await driver.sleep(3000);
            
            // Click OK button first (popup)
            try {
                const okBtn = await driver.findElement(By.xpath("//button[text()='OK']"));
                await okBtn.click();
                await driver.sleep(1000);
            } catch {
                console.log('No OK popup found');
            }
            
            // Click login dropdown
            const loginDropdown = await driver.findElement(By.css(".h_menu_drop_button.hidden-xs"));
            await loginDropdown.click();
            await driver.sleep(1000);
            
            // Click LOGIN button
            const loginBtn = await driver.findElement(By.xpath("//button[text()='LOGIN']"));
            await loginBtn.click();
            await driver.sleep(2000);
            
            // Fill credentials with JavaScript execution to bypass autofill
            console.log(`Filling username: ${username}`);
            await driver.executeScript(`
                const usernameField = document.querySelector("[placeholder='User Name']");
                usernameField.value = '';
                usernameField.dispatchEvent(new Event('input', { bubbles: true }));
                usernameField.value = '${username}';
                usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            `);
            await driver.sleep(1000);
            
            console.log(`Filling password: ${password}`);
            await driver.executeScript(`
                const passwordField = document.querySelector("[placeholder='Password']");
                passwordField.value = '';
                passwordField.dispatchEvent(new Event('input', { bubbles: true }));
                passwordField.value = '${password}';
                passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            `);
            await driver.sleep(1000);
            
            // Auto-solve captcha with retry mechanism
            let captchaAttempts = 0;
            let loginSuccess = false;
            
            while (!loginSuccess && captchaAttempts < 3) {
                captchaAttempts++;
                console.log(`\nLogin attempt ${captchaAttempts}/3`);
                
                // Get captcha image
                const captchaImg = await driver.findElement(By.css('.captcha-img'));
                const captchaBase64 = await captchaImg.getAttribute('src');
                
                // Solve captcha with retry mechanism
                const captchaResult = await this.solveCaptchaWithRetry(captchaBase64.split(',')[1]);
                
                if (captchaResult.success) {
                    // Fill captcha
                    await driver.executeScript(`
                        const captchaField = document.querySelector("[name='captcha']");
                        captchaField.value = '';
                        captchaField.value = '${captchaResult.text}';
                        captchaField.dispatchEvent(new Event('input', { bubbles: true }));
                    `);
                    
                    // Wait until captcha field is filled
                    await driver.wait(async () => {
                        const captchaValue = await driver.executeScript(`
                            return document.querySelector("[name='captcha']").value;
                        `);
                        return captchaValue && captchaValue.length > 0;
                    }, 5000);
                    
                    console.log('Captcha filled, clicking SIGN IN...');
                    
                    // Click SIGN IN button
                    const signInBtn = await driver.findElement(By.xpath("//button[normalize-space()='SIGN IN']"));
                    await signInBtn.click();
                    await driver.sleep(3000);
                    
                    // Check if login was successful
                    try {
                        await driver.findElement(By.css('.profile-name'), 5000);
                        loginSuccess = true;
                        console.log('✅ Login successful!');
                    } catch {
                        console.log('❌ Login failed, trying again...');
                        // Refresh captcha for next attempt
                        try {
                            const refreshBtn = await driver.findElement(By.css('.glyphicon-repeat'));
                            await refreshBtn.click();
                            await driver.sleep(2000);
                        } catch {}
                    }
                } else {
                    console.log('❌ Captcha solving failed, trying again...');
                    // Refresh captcha
                    try {
                        const refreshBtn = await driver.findElement(By.css('.glyphicon-repeat'));
                        await refreshBtn.click();
                        await driver.sleep(2000);
                    } catch {}
                }
            }
            
            if (!loginSuccess) {
                throw new Error('Login failed after 3 attempts');
            }
            
            // Extract tokens from browser
            await driver.sleep(2000);
            const tokens = await driver.executeScript(`
                return {
                    bearer: localStorage.getItem('authToken') || sessionStorage.getItem('authToken'),
                    bmiyek: localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken'),
                    greq: localStorage.getItem('greqToken') || sessionStorage.getItem('greqToken'),
                    csrf: document.querySelector('meta[name="csrf-token"]')?.content
                };
            `);
            
            // Get cookies
            const cookies = await driver.manage().getCookies();
            
            console.log('✅ Tokens extracted from browser!');
            return {
                success: true,
                tokens,
                cookies: cookies.map(c => `${c.name}=${c.value}`)
            };
            
        } catch (error) {
            console.error('Browser token extraction failed:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (driver) await driver.quit();
        }
    }

    async authenticateWithTokens(accessToken, refreshToken, greqToken, csrfToken) {
        try {
            console.log('Authenticating with IRCTC tokens...');
            
            // Store tokens
            this.sessionData.tokens.bearer = accessToken;
            this.sessionData.tokens.bmiyek = refreshToken;
            this.sessionData.tokens.greq = greqToken;
            this.sessionData.tokens.csrf = csrfToken;
            
            const headers = {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json; charset=UTF-8',
                'authorization': `Bearer ${accessToken}`,
                'bmiyek': refreshToken,
                'greq': greqToken,
                'bmirak': 'webbm',
                'X-Requested-With': 'XMLHttpRequest'
            };
            
            if (csrfToken) {
                headers['spa-csrf-token'] = csrfToken;
            }
            
            if (this.sessionData.cookies) {
                headers['Cookie'] = this.sessionData.cookies.map(cookie => cookie.split(';')[0]).join('; ');
            }

            const response = await this.connection.client.get(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/validateUser?source=3`,
                { headers }
            );

            if (response.status === 200) {
                console.log('✅ Authentication successful!');
                return {
                    success: true,
                    message: 'Authentication successful',
                    userData: response.data
                };
            }
            
            return { success: false, error: 'Authentication failed' };
            
        } catch (error) {
            console.error('Authentication error:', error.message);
            return { success: false, error: error.message };
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

    // Unified captcha solving with retry mechanism
    async solveCaptchaWithRetry(captchaImageBase64, maxRetries = 3) {
        console.log('Starting captcha solving with retry mechanism...');
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`Captcha attempt ${attempt}/${maxRetries}`);
            
            try {
                const CaptchaSolver = require('./captcha-solver');
                const solver = new CaptchaSolver();
                const solveResult = await solver.solveCaptcha(captchaImageBase64);
                await solver.terminate();
                
                if (solveResult.success && solveResult.text) {
                    console.log(`✅ Captcha auto-solved: ${solveResult.text}`);
                    return { success: true, text: solveResult.text, isManual: false };
                }
            } catch (error) {
                console.log(`❌ Auto-solve attempt ${attempt} failed:`, error.message);
            }
        }
        
        // All auto-solve attempts failed, ask user
        console.log('\n⚠️ Auto-solve failed after 3 attempts.');
        console.log('You have 15 seconds to enter captcha manually...');
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('\n⏰ Timeout! No captcha entered.');
                resolve({ success: false, error: 'Captcha timeout' });
            }, 15000);
            
            process.stdin.once('data', (data) => {
                clearTimeout(timeout);
                const manualCaptcha = data.toString().trim();
                if (manualCaptcha) {
                    console.log(`✅ Manual captcha entered: ${manualCaptcha}`);
                    resolve({ success: true, text: manualCaptcha, isManual: true });
                } else {
                    resolve({ success: false, error: 'Empty captcha' });
                }
            });
        });
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