const CONFIG = require('./config/config');
const ProxyManager = require('./utils/proxy-manager');
const IRCTCConnection = require('./services/irctc-connection');
const IRCTCService = require('./services/irctc-service');

async function demonstratePersistentSession() {
    console.log('🔄 Demonstrating Persistent Session with Live Token Updates');
    console.log('===========================================================\n');
    
    const proxyManager = new ProxyManager(CONFIG.proxies);
    const connection = new IRCTCConnection(proxyManager);
    const irctcService = new IRCTCService(connection);
    
    try {
        // Step 1: Initialize persistent session
        console.log('1. Initializing persistent session...');
        const loginResult = await irctcService.performLogin();
        
        if (!loginResult.success) {
            console.log('❌ Failed to initialize session:', loginResult.error);
            return;
        }
        
        console.log('✅ Persistent session initialized');
        console.log('📊 Initial tokens:', irctcService.sessionData.tokens.bearer?.substring(0, 20) + '...');
        
        // Step 2: Simulate multiple API calls over time
        console.log('\n2. Making multiple API calls to test token persistence...');
        
        for (let i = 1; i <= 5; i++) {
            console.log(`\n🔄 API Call ${i}:`);
            
            // Search trains
            const searchResult = await irctcService.searchTrains({
                fromStation: 'SC',
                toStation: 'EE',
                journeyClass: '3A',
                journeyDate: '20260202'
            });
            
            if (searchResult.success) {
                console.log(`✅ Search successful - Found ${searchResult.trains.length} trains`);
                console.log(`📊 Current token: ${irctcService.sessionData.tokens.bearer?.substring(0, 20)}...`);
            } else {
                console.log('❌ Search failed:', searchResult.error);
            }
            
            // Wait between calls to simulate real usage
            if (i < 5) {
                console.log('⏳ Waiting 10 seconds before next call...');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        // Step 3: Manually trigger token refresh to demonstrate live updates
        console.log('\n3. Manually triggering token refresh...');
        const refreshResult = await irctcService.refreshTokensFromLiveSession();
        
        if (refreshResult.success) {
            console.log('✅ Token refresh successful');
            console.log('📊 New token:', refreshResult.tokens.bearer?.substring(0, 20) + '...');
        } else {
            console.log('❌ Token refresh failed:', refreshResult.error);
        }
        
        // Step 4: Test automatic token update detection
        console.log('\n4. Session will continue monitoring for token updates in background...');
        console.log('💡 Any token updates from IRCTC will be automatically captured and applied');
        
        // Keep session alive for a bit longer to demonstrate monitoring
        console.log('⏳ Keeping session alive for 30 seconds to demonstrate monitoring...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
    } catch (error) {
        console.error('❌ Demo error:', error.message);
    } finally {
        // Step 5: Clean shutdown
        console.log('\n5. Closing persistent session...');
        await irctcService.closeSession();
        console.log('✅ Session closed successfully');
    }
}

// Run the demonstration
if (require.main === module) {
    demonstratePersistentSession().catch(console.error);
}

module.exports = { demonstratePersistentSession };