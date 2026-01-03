const CONFIG = require('../config/config');

class IRCTCService {
    constructor(connection) {
        this.connection = connection;
        this.sessionData = {
            cookies: null,
            tokens: { bearer: null, bmiyek: null, greq: null, csrf: null }
        };
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.tokenExtractor = null; 
        this.circuitBreakerActive = false; 
        this.last503Time = null;
    }

    getStandardHeaders(customReferer = null) {
        const { tokens } = this.sessionData;
        
        // STRICT BROWSER FINGERPRINT - DO NOT CHANGE ORDER
        const headers = {
            'Host': 'www.irctc.co.in',
            'Connection': 'keep-alive',
            'Accept': 'application/json, text/plain, */*',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'X-Requested-With': 'XMLHttpRequest',
            'sec-ch-ua-mobile': '?0',
            'User-Agent': this.userAgent,
            'sec-ch-ua-platform': '"Windows"',
            'Content-Type': 'application/json; charset=UTF-8',
            'Origin': 'https://www.irctc.co.in',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Referer': customReferer || 'https://www.irctc.co.in/nget/train-search',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        if (tokens && tokens.bearer) {
            headers['Authorization'] = `Bearer ${tokens.bearer.trim()}`;
            headers['bmiyek'] = tokens.bmiyek || '';
            headers['greq'] = tokens.greq ? tokens.greq.trim() : '';
            headers['bmirak'] = 'webbm';
            if (tokens.csrf) headers['spa-csrf-token'] = tokens.csrf.trim();
        }
        return headers;
    }

    async apiRequest(method, url, payload, referer, attempts = 3, skipAutoRefresh = false) {
        for (let i = 1; i <= attempts; i++) {
            try {
                const config = { headers: this.getStandardHeaders(referer), timeout: 15000 };
                const response = method === 'post' ? await this.connection.client.post(url, payload, config) : await this.connection.client.get(url, config);
                return { success: true, data: response.data };
            } catch (error) {
                if (error.response?.status === 503) {
                    console.log('🚨 Server Load: Pausing 10s...');
                    this.last503Time = Date.now();
                    await new Promise(r => setTimeout(r, 10000));
                }
                
                // Handle invalid token error
                if (!skipAutoRefresh && (error.response?.data?.error === 'invalid_token' || 
                    (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('invalid_token')))) {
                    console.log(`🔄 Invalid token detected on attempt ${i}, refreshing...`);
                    const refreshResult = await this.refreshTokensFromLiveSession();
                    if (refreshResult.success) {
                        console.log('✅ Token refreshed, retrying request...');
                        continue; // Retry with new token
                    } else {
                        console.log('❌ Token refresh failed');
                        return { success: false, error: 'Token refresh failed: ' + refreshResult.error };
                    }
                }
                
                if (i === attempts) {
                    console.log(`❌ Request failed after ${attempts} attempts:`, error.message);
                    return { success: false, error: error.message, data: error.response?.data };
                }
                
                console.log(`⚠️ Attempt ${i} failed, retrying in 4s...`);
                await new Promise(r => setTimeout(r, 4000));
            }
        }
    }

    async testHandshake() {
        try {
            const response = await this.connection.client.get(`${CONFIG.irctc.baseUrl}/nget/train-search`);
            return { success: response.status === 200 };
        } catch (e) { return { success: false, error: e.message }; }
    }

    async performLogin() {
        try {
            console.log('\n🚀 Starting IRCTC login process...');
            if (!this.tokenExtractor) {
                const TokenExtractorClass = require('./token-extractor');
                this.tokenExtractor = new TokenExtractorClass(this.connection.proxyManager);
                this.tokenExtractor.onTokenUpdate((t) => { this.sessionData.tokens = t; this.updateAxiosHeaders(); });
            }
            const result = await this.tokenExtractor.initializeSession(CONFIG.irctc.username, CONFIG.irctc.password);
            if (!result.success) return result;
            this.sessionData.tokens = result.tokens;
            this.sessionData.cookies = result.cookies;
            this.updateAxiosHeaders();
            return { success: true, tokens: result.tokens };
        } catch (error) { return { success: false, error: error.message }; }
    }

    updateAxiosHeaders() {
        if (this.sessionData.cookies) {
            this.connection.client.defaults.headers.common['Cookie'] = this.sessionData.cookies;
        }
        this.connection.client.defaults.headers.common['User-Agent'] = this.userAgent;
    }

    async refreshTokensFromLiveSession(attempt = 1) {
        if (!this.tokenExtractor) return { success: false };
        
        console.log(`🔄 Refreshing tokens (attempt ${attempt}/3)...`);
        
        // Get fresh cookies first
        const freshCookies = await this.tokenExtractor.getCookieString();
        if (freshCookies) {
            this.sessionData.cookies = freshCookies;
            this.connection.client.defaults.headers.common['Cookie'] = freshCookies;
        }

        // Get completely fresh tokens
        const newTokens = await this.tokenExtractor.refreshTokens();
        
        if (newTokens && newTokens.bearer && newTokens.csrf && newTokens.greq) {
            console.log('✅ Fresh tokens obtained:', {
                bearer: newTokens.bearer.substring(0, 8) + '...',
                csrf: newTokens.csrf ? 'present' : 'missing',
                greq: newTokens.greq ? 'present' : 'missing'
            });
            
            this.sessionData.tokens = newTokens;
            this.updateAxiosHeaders();
            
            // Small delay to ensure token is active
            await new Promise(r => setTimeout(r, 1000));
            return { success: true, tokens: newTokens };
        }
        
        if (attempt < 3) {
            await new Promise(r => setTimeout(r, 2000));
            return this.refreshTokensFromLiveSession(attempt + 1);
        }
        
        return { success: false, error: 'Failed to get valid tokens after 3 attempts' };
    }

    // --- ORIGINAL FUNCTIONALITY PRESERVED ---
    async searchTrains(params) {
        const payload = { concessionBooking: false, srcStn: params.fromStation, destStn: params.toStation, jrnyClass: params.journeyClass || '3A', jrnyDate: params.journeyDate, quotaCode: params.quotaCode || 'GN', ticketType: 'E', currentBooking: 'false', flexiFlag: false, ftBooking: false, handicapFlag: false, loyaltyRedemptionBooking: false };
        const res = await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/altAvlEnq/TC`, payload);
        return res.success ? { success: true, trains: res.data.trainBtwnStnsList || [] } : res;
    }

    async getAvailabilityAndFare(trainNo, date, from, to, cls, quota) {
        const url = `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/avlFarenquiry/${trainNo}/${date}/${from}/${to}/${cls}/${quota}/N`;
        const payload = { paymentFlag: "N", concessionBooking: false, ftBooking: false, loyaltyRedemptionBooking: false, ticketType: "E", classCode: cls, fromStnCode: from, toStnCode: to, quotaCode: quota, trainNumber: trainNo, journeyDate: date, isLogedinReq: true, moreThanOneDay: true };
        return await this.apiRequest('post', url, payload, 'https://www.irctc.co.in/nget/train-search');
    }

    async executeCompleteBooking(bookingParams) {
        try {
            console.log('\n🎯 ========== STARTING COMPLETE BOOKING FLOW ==========');
            
            // Step 0: Validate booking parameters
            console.log('🚀 Step 0: Validating booking parameters...');
            this.validateBookingRequest(bookingParams);
            
            // Step 1: Ensure we're logged in with fresh tokens
            console.log('🚀 Step 1: Validating login and refreshing tokens...');
            const loginRes = await this.performLogin();
            if (!loginRes.success) throw new Error(loginRes.error);
            
            // Step 2: Validating route and warming sequence
            console.log('🚀 Step 2: Validating route and warming sequence...');
            const boardingPayload = { 
                alternateAvlInputDTO: [{ 
                    trainNo: bookingParams.trainNumber.toString(), 
                    destStn: bookingParams.toStation, 
                    srcStn: bookingParams.fromStation, 
                    jrnyDate: bookingParams.journeyDate, 
                    quotaCode: bookingParams.quotaCode || 'GN', 
                    jrnyClass: bookingParams.journeyClass 
                }], 
                destStn: bookingParams.toStation, 
                jrnyClass: bookingParams.journeyClass, 
                jrnyDate: bookingParams.journeyDate, 
                quotaCode: bookingParams.quotaCode || 'GN', 
                srcStn: bookingParams.fromStation, 
                trainNo: bookingParams.trainNumber.toString(), 
                paymentType: 1, 
                reservationMode: "WS_TA_B2C" 
            };

            // Call 1: Establish Intent
            await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/boardingStationEnq`, boardingPayload, 'https://www.irctc.co.in/nget/train-search');
            
            // Call 2: Final Price Sync
            await this.getAvailabilityAndFare(bookingParams.trainNumber, bookingParams.journeyDate, bookingParams.fromStation, bookingParams.toStation, bookingParams.journeyClass, bookingParams.quotaCode || 'GN');
            
            // Get fresh tokens immediately after warm-up
            console.log('🔄 Getting fresh tokens after warm-up...');
            if (this.tokenExtractor) {
                const freshTokens = await this.tokenExtractor.getFreshTokensForBooking();
                if (freshTokens && freshTokens.bearer) {
                    console.log('✅ Fresh tokens obtained after warm-up');
                    this.sessionData.tokens = freshTokens;
                    this.updateAxiosHeaders();
                }
            }
            
            // ATOMIC SUBMISSION BLOCK
            console.log('🚀 Step 3: Atomic Passenger Submission...');
            
            // Use existing tokens immediately after warm-up to minimize drift
            const targetTrain = {
                trainNumber: bookingParams.trainNumber.toString(),
                trainName: 'GARIBRATH EXP',
                toStnCode: bookingParams.toStation
            };
            
            const complexRequest = this.createComplexBookingRequest(bookingParams, targetTrain);
            console.log('📋 Passenger request created with clientTxnId:', complexRequest.clientTransactionId);
            
            let passRes = await this.submitPassengerDetails(complexRequest);
            
            // Only refresh if we get invalid_token error
            if (!passRes.success && passRes.data?.error === 'invalid_token') {
                console.log('🔄 Token expired, attempting JIT refresh...');
                const jitRefresh = await this.refreshTokensFromLiveSession();
                if (jitRefresh.success) {
                    passRes = await this.submitPassengerDetails(complexRequest);
                }
            }
            
            // Step 4: Handle sequence recovery if needed
            if (!passRes.success || !passRes.data || (!passRes.data.captcha && !passRes.data.captchaImage)) {
                console.log('🔄 Token may be burned, attempting fresh session...');
                
                // Get completely fresh session
                if (this.tokenExtractor) {
                    const freshTokens = await this.tokenExtractor.getFreshTokensForBooking();
                    if (freshTokens && freshTokens.bearer) {
                        console.log('✅ Fresh tokens obtained, retrying...');
                        this.sessionData.tokens = freshTokens;
                        this.updateAxiosHeaders();
                        
                        // Immediate retry with fresh tokens
                        passRes = await this.submitPassengerDetails(complexRequest);
                    }
                }
            }

            // Step 5: Final validation
            if (!passRes.success || !passRes.data || (!passRes.data.captcha && !passRes.data.captchaImage)) {
                const errorDetail = passRes.data?.errorMessage || passRes.data?.message || passRes.error || "Empty Response";
                console.log('❌ Passenger submission final failure:', errorDetail);
                console.log('📋 Response data:', JSON.stringify(passRes.data, null, 2));
                throw new Error(`IRCTC Rejected Submission: ${errorDetail}`);
            }

            console.log('✅ Passenger details accepted. Captcha received for review page.');
            
            // Step 6: Solve captcha
            console.log('🚀 Step 6: Solving review captcha...');
            const captchaAnswer = await this.solveReviewCaptcha(passRes.data.captcha || passRes.data.captchaImage);
            
            // Step 7: Submit captcha and confirm booking
            console.log('🚀 Step 7: Confirming booking with captcha...');
            const confirmRes = await this.confirmBooking(passRes.clientTransactionId, captchaAnswer);
            if (!confirmRes.success || confirmRes.data?.error) {
                throw new Error(`Booking Confirmation Failed: ${confirmRes.data?.error || "Sequence Mismatch"}`);
            }

            console.log('✅ Booking confirmed. Proceeding to payment...');
            
            // Step 8: Initialize payment
            console.log('🚀 Step 8: Initializing payment...');
            const paymentRes = await this.initEWalletPayment(passRes.clientTransactionId, bookingParams.amount || 500);
            if (!paymentRes.success) throw new Error("Payment Initialization Failed");
            
            return { 
                success: true, 
                clientTransactionId: passRes.clientTransactionId, 
                paymentData: paymentRes.data,
                message: "Booking flow completed successfully"
            };
            
        } catch (error) { 
            console.error(`\n❌ BOOKING FLOW FAILED: ${error.message}`);
            return { success: false, error: error.message }; 
        }
    }

    validateBookingRequest(request) {
        const required = ['fromStation', 'toStation', 'journeyClass', 'journeyDate', 'trainNumber', 'passengers', 'mobileNumber'];
        const missing = required.filter(field => !request[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        // Validate passengers
        if (!Array.isArray(request.passengers) || request.passengers.length === 0) {
            throw new Error('At least one passenger is required');
        }
        
        request.passengers.forEach((p, i) => {
            if (!p.passengerName || !p.passengerAge || !p.passengerGender) {
                throw new Error(`Passenger ${i + 1} is missing required fields (name, age, gender)`);
            }
        });
        
        // Validate date format (YYYYMMDD)
        if (!/^\d{8}$/.test(request.journeyDate)) {
            throw new Error('Journey date must be in YYYYMMDD format');
        }
        
        // Validate mobile number
        if (!/^[6-9]\d{9}$/.test(request.mobileNumber)) {
            throw new Error('Mobile number must be a valid 10-digit Indian number');
        }
        
        console.log('✅ Booking request validation passed');
        return true;
    }

    createComplexBookingRequest(params, targetTrain) {
        const clientTxnId = Date.now().toString() + Math.floor(Math.random() * 1000000);
        
        return {
            autoUpgradationSelected: false,
            boardingStation: params.boardingStation || params.fromStation,
            bookOnlyIfCnf: true,
            bookingChoice: 1,
            bookingConfirmChoice: 1,
            captcha: "",
            captureAddress: 0,
            clientTransactionId: clientTxnId,
            clusterFlag: "N",
            cod: "false",
            connectingJourney: false,
            ftBooking: false,
            ftTnCAgree: false,
            generalistChildConfirm: false,
            gnToCkOpted: false,
            gstDetails: {
                error: null,
                gstIn: ""
            },
            journalistBooking: false,
            lapAvlRequestDTO: [{
                addMealInput: null,
                autoUpgradation: false,
                bookOnlyIfCnf: true,
                coachId: null,
                coachPreferred: false,
                fromStation: params.fromStation,
                ignoreChoiceIfWl: false,
                journeyClass: params.journeyClass,
                journeyDate: params.journeyDate,
                passengerList: params.passengers.map((p, i) => ({
                    passengerName: p.passengerName.toUpperCase(),
                    passengerAge: p.passengerAge,
                    passengerGender: p.passengerGender,
                    passengerNationality: "IN",
                    passengerSerialNumber: i + 1,
                    passengerIcardFlag: false,
                    passengerCardType: "NULL_IDCARD",
                    passengerBerthChoice: p.passengerBerthChoice || "",
                    childBerthFlag: false
                })),
                quota: params.quotaCode || "GN",
                reservationChoice: 1,
                ssQuotaSplitCoach: "N",
                toStation: targetTrain.toStnCode,
                trainNo: targetTrain.trainNumber,
                travelInsuranceOpted: "true",
                warrentType: 0
            }],
            loyaltyBankId: null,
            loyaltyNumber: null,
            loyaltyRedemptionBooking: false,
            mainJourneyPnr: "",
            mainJourneyTxnId: null,
            mobileNumber: params.mobileNumber,
            moreThanOneDay: false,
            nosbBooking: false,
            onwardFlag: "N",
            passBooking: false,
            paymentType: 1,
            reservationMode: "WS_TA_B2C",
            reservationUptoStation: targetTrain.toStnCode,
            returnJourney: null,
            ticketType: "E",
            twoPhaseAuthRequired: false,
            warrentType: 0,
            wsUserLogin: params.irctcUsername || CONFIG.irctc.username
        };
    }
    async submitPassengerDetails(bookingRequest) {
        try {
            console.log('🚀 Submitting passenger details with un-burned tokens...');
            
            // Use HTTP client with current tokens immediately
            const response = await this.apiRequest(
                'post',
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/allLapAvlFareEnq/Y`,
                bookingRequest,
                'https://www.irctc.co.in/nget/booking/psgninput'
            );

            if (response.success && response.data && (response.data.captcha || response.data.captchaImage)) {
                console.log('✅ Passenger submission successful - captcha received!');
                return { 
                    success: true, 
                    data: response.data, 
                    clientTransactionId: bookingRequest.clientTransactionId 
                };
            } else {
                console.log('❌ Passenger submission failed');
                console.log('Response data:', JSON.stringify(response.data, null, 2));
                return { 
                    success: false, 
                    error: 'No captcha returned from passenger submission',
                    data: response.data
                };
            }
        } catch (error) {
            console.log('❌ Passenger submission error:', error.message);
            return { success: false, error: error.message };
        }
    }
    async solveReviewCaptcha(captchaData) { const CaptchaSolver = require('./captcha-solver'); const solver = new CaptchaSolver(); const result = await solver.solveCaptcha(captchaData); await solver.terminate(); return result.text; }
    async confirmBooking(clientTxnId, captchaAnswer) { return await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/addonServices`, { captchaAns: captchaAnswer, captchaType: "BOOKINGWS", clientTxnId: clientTxnId, paymentType: 1, addonLapServices: [{ travelInsuranceOpted: true }] }, 'https://www.irctc.co.in/nget/booking/psgninput'); }
    async initEWalletPayment(clientTxnId, amount) { return await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/bookingInitPayment/${clientTxnId}?insurenceApplicable=`, { bankId: 1000, txnType: 7, paramList: [{ key: "TXN_PASSWORD", value: "" }], amount: amount.toString(), transationId: 0, txnStatus: 1 }, 'https://www.irctc.co.in/nget/payment/bkgPaymentOptions'); }
    async getSessionInfo() { return { success: true, tokens: this.sessionData.tokens, hasValidSession: !!this.sessionData.tokens.bearer }; }
    async closeSession() { if (this.tokenExtractor) await this.tokenExtractor.closeSession(); }
}
module.exports = IRCTCService;