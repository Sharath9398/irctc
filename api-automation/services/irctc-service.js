const CONFIG = require('../config/config');
const CaptchaSolver = require('./captcha-solver');
const TokenExtractor = require('./token-extractor'); // Import this at the top

class IRCTCService {
    constructor(connection) {
        this.connection = connection;
        this.sessionData = {
            cookies: null,
            tokens: { bearer: null, bmiyek: null, greq: null, csrf: null }
        };
        this.bookingData = {
            clientTransactionId: null,
            bookingResponse: null,
            paymentData: null
        };
    }

    /**
     * CENTRALIZED HEADER GENERATOR
     * This replaces all the manual header objects in your previous code.
     */
    getStandardHeaders(isPost = false, customReferer = null) {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': isPost ? 'application/json; charset=UTF-8' : 'application/x-www-form-urlencoded',
            'bmirak': 'webbm',
            'Content-Language': 'en',
            'greq': this.sessionData.tokens.greq || Date.now().toString(),
            'spa-csrf-token': this.sessionData.tokens.csrf || '',
            'authorization': this.sessionData.tokens.bearer ? `Bearer ${this.sessionData.tokens.bearer}` : '',
            'bmiyek': this.sessionData.tokens.bmiyek || '',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
            'Referer': customReferer || 'https://www.irctc.co.in/nget/train-search',
            'X-Requested-With': 'XMLHttpRequest'
        };

        if (this.sessionData.cookies) {
            headers['Cookie'] = Array.isArray(this.sessionData.cookies) 
                ? this.sessionData.cookies.map(c => c.split(';')[0]).join('; ') 
                : this.sessionData.cookies;
        }
        return headers;
    }

    async performLogin() {
        try {
            console.log('\n🚀 STEP 1: Starting IRCTC login process...');
            console.log('🔗 Initializing TokenExtractor with proxy manager');
            const extractor = new TokenExtractor(this.connection.proxyManager);
            
            console.log('🔑 Attempting login with credentials:');
            console.log(`  - Username: ${CONFIG.irctc.username}`);
            console.log(`  - Password: ${'*'.repeat(CONFIG.irctc.password.length)}`);
            
            const result = await extractor.extractTokens(CONFIG.irctc.username, CONFIG.irctc.password);
            
            if (!result.success) {
                console.log('❌ Login failed:', result.error);
                return { success: false, error: result.error };
            }

            console.log('\n💾 STEP 2: Mapping extracted tokens to session...');
            // Map tokens back to sessionData
            this.sessionData.tokens = {
                bearer: result.tokens.bearer,
                bmiyek: result.tokens.bmiyek,
                greq: result.tokens.greq,
                csrf: result.tokens.csrf
            };
            this.sessionData.cookies = result.cookies;
            
            console.log('📋 Session tokens mapped:');
            console.log(`  - Bearer: ${this.sessionData.tokens.bearer ? 'Set' : 'Missing'}`);
            console.log(`  - BMIyek: ${this.sessionData.tokens.bmiyek ? 'Set' : 'Missing'}`);
            console.log(`  - GREQ: ${this.sessionData.tokens.greq ? 'Set' : 'Missing'}`);
            console.log(`  - CSRF: ${this.sessionData.tokens.csrf ? 'Set' : 'Missing'}`);
            console.log(`  - Cookies: ${this.sessionData.cookies ? 'Set' : 'Missing'}`);

            console.log('\n✅ STEP 3: Login and token extraction completed successfully!');
            return { success: true, message: 'Login successful', tokens: result.tokens };
        } catch (error) {
            console.error('❌ Login error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // --- REFACTORED API METHODS USING THE SHARED HEADER LOGIC ---

    async getCaptcha() {
        try {
            const response = await this.connection.client.get(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginCaptcha`,
                { headers: this.getStandardHeaders() }
            );
            if (response.headers['set-cookie']) this.sessionData.cookies = response.headers['set-cookie'];
            
            const data = response.data;
            return (data && data.captchaQuestion) 
                ? { success: true, captchaImage: data.captchaQuestion, captchaTime: data.captchaTime, cookies: response.headers['set-cookie'] }
                : { success: false, error: 'Invalid captcha response' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async validateSession() {
        try {
            const response = await this.connection.client.get(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/validateUser?source=3`,
                { headers: this.getStandardHeaders(true) }
            );
            return { success: response.status === 200, valid: response.status === 200 };
        } catch (error) {
            return { success: false, valid: false, error: error.message };
        }
    }

    async searchTrains(searchParams) {
        try {
            console.log('\n🚆 STEP 4: Starting train search...');
            console.log('📋 Search parameters:');
            console.log(`  - From: ${searchParams.fromStation}`);
            console.log(`  - To: ${searchParams.toStation}`);
            console.log(`  - Date: ${searchParams.journeyDate}`);
            console.log(`  - Class: ${searchParams.travelClass}`);
            console.log(`  - Quota: ${searchParams.quota || 'GN'}`);
            
            const payload = {
                concessionBooking: false, srcStn: searchParams.fromStation, destStn: searchParams.toStation,
                jrnyClass: searchParams.travelClass, jrnyDate: searchParams.journeyDate,
                quotaCode: searchParams.quota || 'GN', ticketType: 'E', currentBooking: 'false',
                flexiFlag: false, ftBooking: false, handicapFlag: false, loyaltyRedemptionBooking: false
            };
            
            console.log('📡 Making API request to IRCTC train search...');
            const response = await this.connection.client.post(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/altAvlEnq/TC`,
                payload, { headers: this.getStandardHeaders(true) }
            );
            
            console.log(`✅ Train search successful! Status: ${response.status}`);
            console.log(`🚆 Found ${response.data?.trainBtwnStnsList?.length || 0} trains`);
            
            return { success: true, trains: response.data };
        } catch (error) {
            console.error('❌ Train search failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // --- CAPTCHA SOLVING ---

    async solveCaptchaWithRetry(captchaImageBase64, maxRetries = 3) {
        const solver = new CaptchaSolver();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const solveResult = await solver.solveCaptcha(captchaImageBase64);
                if (solveResult.success && solveResult.text) {
                    await solver.terminate();
                    return { success: true, text: solveResult.text, isManual: false };
                }
            } catch (e) { console.log(`Attempt ${attempt} failed`); }
        }
        await solver.terminate();
        // Fallback to manual input logic... (omitted for brevity but keep your original logic here)
    }

    // --- OTHER METHODS ---
    // Keep your getAvailabilityAndFare, submitPassengerDetails, etc. 
    // Just replace their 'const headers = ...' blocks with 'const headers = this.getStandardHeaders(true);'
    
    async testHandshake() {
        try {
            const headers = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            const response = await this.connection.client.get(
                `${CONFIG.irctc.baseUrl}/nget/train-search`,
                { headers }
            );
            return { success: response.status === 200, status: response.status };
        } catch (error) {
            // If proxy fails, try without proxy
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
                console.log('🚫 Proxy connection failed, trying direct connection...');
                this.connection.proxyManager.disableProxy();
                this.connection.initClient(); // Reinitialize without proxy
                
                try {
                    const headers = {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    };
                    const response = await this.connection.client.get(
                        `${CONFIG.irctc.baseUrl}/nget/train-search`,
                        { headers }
                    );
                    return { success: response.status === 200, status: response.status };
                } catch (retryError) {
                    return { success: false, error: retryError.message };
                }
            }
            return { success: false, error: error.message };
        }
    }

    async executeCompleteBooking(bookingParams) {
        try {
            console.log('\n🎯 ========== STARTING COMPLETE BOOKING FLOW ==========');
            console.log('📅 Booking parameters received:');
            console.log(JSON.stringify(bookingParams, null, 2));
            
            // Step 1: Login
            console.log('\n🔑 PHASE 1: Authentication');
            const loginResult = await this.performLogin();
            if (!loginResult.success) {
                console.log('❌ BOOKING FAILED: Login unsuccessful');
                return { success: false, error: `Login failed: ${loginResult.error}` };
            }
            
            // Step 2: Search trains
            console.log('\n🔍 PHASE 2: Train Search');
            const searchResult = await this.searchTrains(bookingParams);
            if (!searchResult.success) {
                console.log('❌ BOOKING FAILED: Train search unsuccessful');
                return { success: false, error: `Train search failed: ${searchResult.error}` };
            }
            
            console.log('\n🎉 ========== BOOKING FLOW COMPLETED SUCCESSFULLY ==========');
            console.log('📋 Final Results:');
            console.log(`  - Login Status: ✅ Success`);
            console.log(`  - Tokens Extracted: ✅ Success`);
            console.log(`  - Train Search: ✅ Success`);
            console.log(`  - Trains Found: ${searchResult.trains?.trainBtwnStnsList?.length || 0}`);
            
            return { 
                success: true, 
                message: 'Booking flow executed successfully',
                loginTokens: loginResult.tokens,
                trainData: searchResult.trains
            };
        } catch (error) {
            console.error('\n❌ ========== BOOKING FLOW FAILED ==========');
            console.error('Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getSessionInfo() {
        return {
            success: true,
            tokens: this.sessionData.tokens,
            cookies: this.sessionData.cookies,
            hasValidSession: !!(this.sessionData.tokens.bearer && this.sessionData.tokens.greq)
        };
    }

    generateClientTransactionId() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        return `${timestamp}${Math.floor(Math.random() * 900000) + 100000}`;
    }
}

module.exports = IRCTCService;