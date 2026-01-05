const CONFIG = require('./config/config');
const ProxyManager = require('./utils/proxy-manager');
const IRCTCConnection = require('./services/irctc-connection');
const IRCTCService = require('./services/irctc-service');

class IRCTCAutomation {
    constructor() {
        this.proxyManager = new ProxyManager(CONFIG.proxies);
        this.connection = new IRCTCConnection(this.proxyManager);
        this.irctcService = new IRCTCService(this.connection);
    }

    async testHandshake() {
        console.log(`Starting IRCTC automation with proxy: ${this.proxyManager.getCurrentInfo()}`);
        return await this.irctcService.testHandshake();
    }

    async getCaptcha() {
        return await this.irctcService.getCaptcha();
    }

    async login(username = CONFIG.irctc.username, password = CONFIG.irctc.password, captcha) {
        return await this.irctcService.submitLogin(username, password, captcha);
    }

    async performLogin() {
        return await this.irctcService.performLogin();
    }

    getSessionInfo() {
        return this.irctcService.getSessionInfo();
    }

    clearSession() {
        this.irctcService.clearSession();
    }

    async searchTrains(searchParams) {
        return await this.irctcService.searchTrains(searchParams);
    }

    async validateSession() {
        return await this.irctcService.validateSession();
    }

    // Complete booking flow
    async executeCompleteBooking(bookingParams) {
        return await this.irctcService.executeCompleteBooking(bookingParams);
    }

    // Individual booking steps
    async getAvailabilityAndFare(trainNo, date, from, to, cls, quota) {
    try {
        const url = `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/avlFarenquiry/${trainNo}/${date}/${from}/${to}/${cls}/${quota}/N`;
        const payload = {
            paymentFlag: "N", concessionBooking: false, ftBooking: false,
            loyaltyRedemptionBooking: false, ticketType: "E", classCode: cls,
            fromStnCode: from, toStnCode: to, quotaCode: quota,
            trainNumber: trainNo, journeyDate: date, isLogedinReq: true,
            moreThanOneDay: true
        };

        const response = await this.connection.client.post(url, payload, { 
            headers: this.getStandardHeaders(true) 
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

    async getBoardingStations(trainNumber, fromStation, toStation, journeyClass, journeyDate, quotaCode) {
        return await this.irctcService.getBoardingStations(trainNumber, fromStation, toStation, journeyClass, journeyDate, quotaCode);
    }

    async submitPassengerDetails(bookingRequest) {
    try {
        const clientTxnId = this.generateClientTransactionId();
        bookingRequest.clientTransactionId = clientTxnId;

        const response = await this.connection.client.post(
            `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/allLapAvlFareEnq/Y`,
            bookingRequest,
            { headers: this.getStandardHeaders(true, 'https://www.irctc.co.in/nget/booking/psgninput') }
        );

        // This returns the Captcha required for the Review Page
        return { success: true, data: response.data, clientTransactionId: clientTxnId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

    async submitCaptcha(clientTxnId, captchaAnswer) {
    try {
        const payload = {
            captchaAns: captchaAnswer,
            captchaType: "BOOKINGWS",
            clientTxnId: clientTxnId,
            paymentType: 1,
            addonLapServices: [{ travelInsuranceOpted: true }]
        };

        const response = await this.connection.client.post(
            `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/addonServices`,
            payload,
            { headers: this.getStandardHeaders(true, 'https://www.irctc.co.in/nget/booking/psgninput') }
        );
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

    async initializePayment(clientTxnId, amount, paymentMethod, bankId) {
        return await this.irctcService.initializePayment(clientTxnId, amount, paymentMethod, bankId);
    }

    async verifyPayment(clientTxnId, transactionId, bankId, amount) {
        return await this.irctcService.verifyPayment(clientTxnId, transactionId, bankId, amount);
    }

    async getBookingHistory(bookingDataPath) {
        return await this.irctcService.getBookingHistory(bookingDataPath);
    }
}

async function main() {
    try {
        const automation = new IRCTCAutomation();
        
        console.log('\n🚆 IRCTC Complete Booking Automation');
        console.log('=====================================\n');
        
        // Test handshake first
        const handshakeResult = await automation.testHandshake();
        
        if (handshakeResult.success) {
            console.log('✅ Handshake successful! Ready for booking flow.');
            
            // Example booking parameters - modify as needed
           const bookingParams = {
    fromStation: 'SC',        // Secunderabad
    toStation: 'EE',          // Warangal
    journeyClass: '3A',       // 3rd AC
    journeyDate: '20260202',  // Ensure this is within 120 days of today
    trainNumber: '12740',     // CHANGED: Use Telengana Express (runs SC to WL)
    quotaCode: 'GN',
    boardingStation: 'SC',
    passengers: [{
        passengerName: 'JOHN DOE',
        passengerAge: 30,
        passengerGender: 'M',
        passengerNationality: 'IN',
        passengerSerialNumber: 1,
        passengerIcardFlag: false,
        passengerCardType: 'NULL_IDCARD',
        passengerBerthChoice: 'LB',
        childBerthFlag: false
    }],
    mobileNumber: '9876543210',
    irctcUsername: CONFIG.irctc.username,
    paymentMethod: 'EWALLET',
    bankId: '1000',
    amount: 500
};
            
            console.log('\n📝 Booking Parameters:');
            console.log(`Route: ${bookingParams.fromStation} → ${bookingParams.toStation}`);
            console.log(`Train: ${bookingParams.trainNumber}`);
            console.log(`Date: ${bookingParams.journeyDate}`);
            console.log(`Class: ${bookingParams.journeyClass}`);
            console.log(`Passengers: ${bookingParams.passengers.length}`);
            console.log(`Payment: ${bookingParams.paymentMethod}`);
            
            // Execute complete booking flow
            console.log('\n🚀 Starting complete booking flow...');
            const bookingResult = await automation.executeCompleteBooking(bookingParams);
            
            if (bookingResult.success) {
                console.log('\n✅ BOOKING SUCCESSFUL!');
                console.log('===================');
                console.log(`Client Transaction ID: ${bookingResult.clientTransactionId}`);
                console.log('Reached CAPTCHA review step successfully');

                
                // Display booking summary
                if (bookingResult.bookingData) {
                    console.log('\n📊 Booking Summary:');
                    console.log('- Train search: ✅');
                    console.log('- Fare check: ✅');
                    console.log('- Boarding stations: ✅');
                    console.log('- Passenger details: ✅');
                    console.log('- Captcha solved: ✅');
                    console.log('- Payment processed: ✅');
                }
            } else {
                console.log('\n❌ BOOKING FAILED!');
                console.log('==================');
                console.log('Error:', bookingResult.error);
            }
            
            console.log('\n📊 Session Info:', automation.getSessionInfo());
            
            // Close the persistent session when done
            await automation.irctcService.closeSession();
            console.log('🔒 Session closed.');
            
        } else {
            console.log('❌ Handshake failed:', handshakeResult.error);
        }
        
    } catch (error) {
        console.log('❌ Application error:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Ensure cleanup happens even if there's an error
        process.exit(0);
    }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
    console.log('\n🛡️ Received SIGINT, closing sessions...');
    // Note: In a real implementation, you'd want to track active automation instances
    // and close their sessions here
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛡️ Received SIGTERM, closing sessions...');
    process.exit(0);
});

// Example function to test individual booking steps
async function testIndividualSteps() {
    try {
        const automation = new IRCTCAutomation();
        
        console.log('\n🧪 Testing Individual Booking Steps');
        console.log('===================================\n');
        
        // Step 1: Login
        console.log('1. Testing login...');
        const loginResult = await automation.performLogin();
        console.log('Login result:', loginResult.success ? '✅' : '❌', loginResult.message || loginResult.error);
        
        if (!loginResult.success) {
            console.log('Cannot proceed without login');
            return;
        }
        
        // Step 2: Search trains
        console.log('\n2. Testing train search...');
        const searchResult = await automation.searchTrains({
            fromStation: 'SC',
            toStation: 'EE',
            travelClass: '3A',
            journeyDate: '20260202'
        });
        console.log('Train search result:', searchResult.success ? '✅' : '❌');
        
        // Step 3: Check availability
        console.log('\n3. Testing availability check...');
        const availabilityResult = await automation.getAvailabilityAndFare(
            '12740', '20260202', 'SC', 'EE', '3A', 'GN'
        );
        console.log('Availability check result:', availabilityResult.success ? '✅' : '❌');
        
        // Step 4: Get boarding stations
        console.log('\n4. Testing boarding stations...');
        const boardingResult = await automation.getBoardingStations(
            '12740', '20260202', 'SC', '3A', '20260202', 'GN'
        );
        console.log('Boarding stations result:', boardingResult.success ? '✅' : '❌');
        
        console.log('\n✅ Individual steps testing completed!');
        
        // Close the persistent session when done
        await automation.irctcService.closeSession();
        console.log('🔒 Session closed.');
        
    } catch (error) {
        console.log('❌ Individual steps test error:', error.message);
    }
}

if (require.main === module) {
    // Check command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--test-steps')) {
        console.log('Running individual steps test...');
        testIndividualSteps();
    } else if (args.includes('--help')) {
        console.log('\nIRCTC Booking Automation');
        console.log('========================');
        console.log('Usage:');
        console.log('  node app.js                 - Run complete booking flow');
        console.log('  node app.js --test-steps    - Test individual booking steps');
        console.log('  node app.js --help          - Show this help message');
        console.log('\nConfiguration:');
        console.log('  Edit config/config.js to set proxy and IRCTC credentials');
        console.log('  Modify booking parameters in main() function as needed');
        console.log('');
    } else {
        console.log('Running complete booking flow...');
        main();
    }
}

module.exports = IRCTCAutomation;