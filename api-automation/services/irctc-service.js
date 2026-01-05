const CONFIG = require('../config/config');

class IRCTCService {
    constructor(connection) {
        this.connection = connection;
        this.sessionData = {
            cookies: null,
            tokens: { bearer: null, bmiyek: null, greq: null, csrf: null }
        };
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
        this.isSequenceRunning = false;
        this.clientTransactionId = null;
    }

    getStandardHeaders(referer) {
        const { tokens } = this.sessionData;
        return {
            'host': 'www.irctc.co.in',
            'connection': 'keep-alive',
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json; charset=UTF-8',
            'user-agent': this.userAgent,
            'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'origin': 'https://www.irctc.co.in',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'referer': referer || 'https://www.irctc.co.in/nget/train-search',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'authorization': tokens.bearer ? `Bearer ${tokens.bearer}` : '',
            'bmiyek': tokens.bmiyek || '',
            'greq': tokens.greq || '',
            'bmirak': 'webbm',
            'spa-csrf-token': tokens.csrf || ''
        };
    }

    async apiRequest(method, url, payload, referer, attempts = 2) {
        for (let i = 1; i <= attempts; i++) {
            try {
                const config = { headers: this.getStandardHeaders(referer), timeout: 15000 };
                console.log(`[API_SEND] ${url.split('/').pop().split('?')[0]} | CSRF: ...${this.sessionData.tokens.csrf?.slice(-6)}`);
                
                const res = method === 'post' ? await this.connection.client.post(url, payload, config) : await this.connection.client.get(url, config);

                const freshCsrf = res.headers['csrf-token'] || res.headers['spa-csrf-token'];
                if (freshCsrf) {
                    console.log(`[API_RECV] New CSRF: ...${freshCsrf.slice(-6)}`);
                    this.sessionData.tokens.csrf = freshCsrf;
                }
                return { success: true, data: res.data };
            } catch (error) {
                if (error.response?.status === 403) {
                    console.log('🛡️ Akamai 403. Refreshing Browser Page...');
                    await this.tokenExtractor.refreshTokens();
                    continue;
                }
                if (i === attempts) return { success: false, error: error.message };
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    async performLogin() {
        if (!this.tokenExtractor) {
            const TokenExtractorClass = require('./token-extractor');
            this.tokenExtractor = new TokenExtractorClass(this.connection.proxyManager);
        }
        const res = await this.tokenExtractor.initializeSession(CONFIG.irctc.username, CONFIG.irctc.password);
        if (res.success) {
            this.sessionData.tokens = res.tokens;
            this.sessionData.cookies = res.cookies;
            this.updateAxiosHeaders();
        }
        return res;
    }

    updateAxiosHeaders() {
        if (this.sessionData.cookies) this.connection.client.defaults.headers.common['Cookie'] = this.sessionData.cookies;
    }

    async runBookingSequence(params) {
        this.isSequenceRunning = true;
        try {
            console.log('🔍 [Step 1] Handshake Activation...');
            await this.apiRequest('get', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/validateUser?source=3`, null, 'https://www.irctc.co.in/nget/train-search');
            
            await new Promise(r => setTimeout(r, 1000)); // Jitter

            console.log('🚆 [Step 2] Train Search...');
            const sPay = { concessionBooking: false, srcStn: params.fromStation, destStn: params.toStation, jrnyClass: params.journeyClass, jrnyDate: params.journeyDate, quotaCode: params.quotaCode || 'GN', ticketType: 'E', currentBooking: 'false', flexiFlag: false, ftBooking: false, handicapFlag: false, loyaltyRedemptionBooking: false };
            await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/altAvlEnq/TC`, sPay, 'https://www.irctc.co.in/nget/train-search');

            await new Promise(r => setTimeout(r, 1500)); // Human pause

            console.log('🚉 [Step 3] Boarding Points...');
            const bPay = { alternateAvlInputDTO: [{ trainNo: params.trainNumber, destStn: params.toStation, srcStn: params.fromStation, jrnyDate: params.journeyDate, quotaCode: params.quotaCode || 'GN', jrnyClass: params.journeyClass }], destStn: params.toStation, jrnyClass: params.journeyClass, jrnyDate: params.journeyDate, quotaCode: params.quotaCode || 'GN', srcStn: params.fromStation, trainNo: params.trainNumber, paymentType: 1, reservationMode: "WS_TA_B2C" };
            await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/boardingStationEnq`, bPay, 'https://www.irctc.co.in/nget/booking/train-list');
            // ✅ Generate ONE transaction ID for entire booking attempt
this.clientTransactionId = "web_" + Date.now() + Math.floor(Math.random() * 1000);

            console.log('💰 [Step 4] Fare Enquiry...');
            const fUrl = `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/avlFarenquiry/${params.trainNumber}/${params.journeyDate}/${params.fromStation}/${params.toStation}/${params.journeyClass}/${params.quotaCode || 'GN'}/N`;
            const fPay = {  clientTransactionId: this.clientTransactionId,paymentFlag: "N", concessionBooking: false, ftBooking: false, loyaltyRedemptionBooking: false, ticketType: "E", classCode: params.journeyClass, fromStnCode: params.fromStation, toStnCode: params.toStation, quotaCode: params.quotaCode || 'GN', trainNumber: params.trainNumber, journeyDate: params.journeyDate, isLogedinReq: true, moreThanOneDay: true };
            await this.apiRequest('post', fUrl, fPay, 'https://www.irctc.co.in/nget/booking/train-list');

            // --- CRITICAL PAUSE ---
            // IRCTC monitors "Time Spent on Input Page". 4-5 seconds is safe.
            console.log('⏱️ Simulating passenger entry time (4s)...');
            await new Promise(r => setTimeout(r, 4000));

            console.log('👥 [Step 5] Final Submission via Browser...');
            const bReq = this.createComplexBookingRequest(params, { trainNumber: params.trainNumber, toStnCode: params.toStation });
            
            const bRes = await this.tokenExtractor.driver.executeScript(`
                return (async () => {
                    const activeTokens = {
                        bearer: '${this.sessionData.tokens.bearer}',
                        csrf: '${this.sessionData.tokens.csrf}',
                        greq: '${this.sessionData.tokens.greq}'
                    };
                    const r = await fetch('https://www.irctc.co.in/eticketing/protected/mapps1/allLapAvlFareEnq/Y', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'spa-csrf-token': activeTokens.csrf,
                            'greq': activeTokens.greq,
                            'bmirak': 'webbm',
                            'Authorization': 'Bearer ' + activeTokens.bearer
                        },
                        body: JSON.stringify(${JSON.stringify(bReq)})
                    });
                    const text = await r.text();
                    try { return { status: r.status, data: JSON.parse(text) }; } 
                    catch(e) { return { status: r.status, error: text.substring(0,100) }; }
                })();
            `);

           if (
    bRes.status === 200 &&
    (bRes.data?.captchaDto || bRes.data?.captcha || bRes.data?.captchaImage)
) {
    console.log('✅ CAPTCHA review reached');
    return { success: true, data: bRes.data };
}

// ❌ No retry, no refresh
throw new Error('Passenger submission rejected – restart required');


        } finally {
            this.isSequenceRunning = false;
        }
    }

    async executeCompleteBooking(params) {
        try {
            const loginRes = await this.performLogin();
            if (!loginRes.success) throw new Error(loginRes.error);
            
            let res = await this.runBookingSequence(params);

            

            const captchaData = res.data?.captchaDto?.captchaQuestion || res.data?.captcha || res.data?.captchaImage;
            if (!captchaData) throw new Error("Booking Rejected: " + JSON.stringify(res.data));

            console.log('✅ Passenger Accepted. Solving Review Captcha...');
            const captchaAns = await this.solveReviewCaptcha(captchaData);
            const txnId = res.data.clientTransactionId || params.clientTxnId;
            

            return { success: true, clientTransactionId: txnId };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    createComplexBookingRequest(params, targetTrain) {
        
        return {
            autoUpgradationSelected: false, boardingStation: params.fromStation, bookOnlyIfCnf: true, bookingChoice: 1, bookingConfirmChoice: 1, captcha: "", clientTransactionId: this.clientTransactionId
, mobileNumber: params.mobileNumber, paymentType: 1, reservationMode: "WS_TA_B2C", reservationUptoStation: targetTrain.toStnCode, ticketType: "E", wsUserLogin: CONFIG.irctc.username,
            lapAvlRequestDTO: [{
                autoUpgradation: false, bookOnlyIfCnf: true, fromStation: params.fromStation, toStation: targetTrain.toStnCode, journeyClass: params.journeyClass, journeyDate: params.journeyDate, quota: params.quotaCode || 'GN', trainNo: targetTrain.trainNumber, travelInsuranceOpted: "true",
                passengerList: params.passengers.map((p, i) => ({
                    passengerName: p.passengerName.toUpperCase(), passengerAge: p.passengerAge, passengerGender: p.passengerGender, passengerNationality: "IN", passengerSerialNumber: i + 1, passengerCardType: "NULL_IDCARD", childBerthFlag: false
                }))
            }]
        };
    }

    async solveReviewCaptcha(data) { const CaptchaSolver = require('./captcha-solver'); const solver = new CaptchaSolver(); const res = await solver.solveCaptcha(data); await solver.terminate(); return res.text; }
    async confirmBooking(txnId, ans) { return await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/addonServices`, { captchaAns: ans, captchaType: "BOOKINGWS", clientTxnId: txnId, paymentType: 1, addonLapServices: [{ travelInsuranceOpted: true }] }, 'https://www.irctc.co.in/nget/booking/psgninput'); }
    async initEWalletPayment(txnId, amt) { return await this.apiRequest('post', `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/bookingInitPayment/${txnId}?insurenceApplicable=`, { bankId: 1000, txnType: 7, paramList: [], amount: amt.toString(), transationId: 0, txnStatus: 1 }, 'https://www.irctc.co.in/nget/payment/bkgPaymentOptions'); }
    async testHandshake() { try { const res = await this.connection.client.get(`${CONFIG.irctc.baseUrl}/nget/train-search`); return { success: res.status === 200 }; } catch (e) { return { success: false, error: e.message }; } }
    async getSessionInfo() { return { success: true, tokens: this.sessionData.tokens, hasValidSession: !!this.sessionData.tokens.bearer }; }
    async closeSession() { if (this.tokenExtractor) await this.tokenExtractor.closeSession(); }
}

module.exports = IRCTCService;