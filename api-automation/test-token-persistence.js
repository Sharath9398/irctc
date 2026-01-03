const CONFIG = require('./config/config');
const ProxyManager = require('./utils/proxy-manager');
const IRCTCConnection = require('./services/irctc-connection');
const IRCTCService = require('./services/irctc-service');

async function testTokenPersistence() {
    console.log('🔄 Testing Token Persistence During API Calls');
    console.log('==============================================\n');
    
    const proxyManager = new ProxyManager(CONFIG.proxies);
    const connection = new IRCTCConnection(proxyManager);
    const irctcService = new IRCTCService(connection);
    
    try {
        // Step 1: Initialize session
        console.log('1. Initializing session...');
        const loginResult = await irctcService.performLogin();
        
        if (!loginResult.success) {
            console.log('❌ Login failed:', loginResult.error);
            return;
        }
        
        console.log('✅ Session initialized');
        console.log('📊 Initial token:', irctcService.sessionData.tokens.bearer?.substring(0, 20) + '...');
        
        // Step 2: Set up token monitoring
        let tokenUpdates = 0;
        if (irctcService.tokenExtractor) {
            irctcService.tokenExtractor.onTokenUpdate((newTokens) => {
                tokenUpdates++;
                console.log(`🔄 Auto-update #${tokenUpdates}: ${newTokens.bearer?.substring(0, 20)}...`);
            });
        }
        
        // Step 3: Make multiple API calls to test persistence
        console.log('\n2. Testing API calls with persistent session...');
        
        for (let i = 1; i <= 3; i++) {
            console.log(`\n🔄 API Test ${i}:`);
            
            const searchResult = await irctcService.searchTrains({
                fromStation: 'SC',
                toStation: 'EE',
                journeyClass: '3A',
                journeyDate: '20260202'
            });
            
            if (searchResult.success) {
                console.log(`✅ Search ${i} successful - ${searchResult.trains.length} trains found`);
                console.log(`📊 Current token: ${irctcService.sessionData.tokens.bearer?.substring(0, 20)}...`);
            } else {
                console.log(`❌ Search ${i} failed:`, searchResult.error);
            }
            
            // Small delay between calls
            if (i < 3) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Step 4: Test manual token refresh
        console.log('\n3. Testing manual token refresh...');
        const refreshResult = await irctcService.refreshTokensFromLiveSession();
        
        if (refreshResult.success) {
            console.log('✅ Manual refresh successful');
            console.log('📊 New token:', refreshResult.tokens.bearer?.substring(0, 20) + '...');
        } else {
            console.log('❌ Manual refresh failed:', refreshResult.error);
        }
        
        console.log(`\n📊 Total automatic token updates: ${tokenUpdates}`);
        console.log('✅ Persistent session test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        console.log('\n4. Closing session...');
        await irctcService.closeSession();
        console.log('✅ Session closed');
    }
}

if (require.main === module) {
    testTokenPersistence().catch(console.error);
}

module.exports = { testTokenPersistence };