const CONFIG = require('./config/config');
const ProxyManager = require('./utils/proxy-manager');
const TokenExtractor = require('./services/token-extractor');

async function testPersistentSession() {
    console.log('🧪 Testing Persistent Session Functionality');
    console.log('==========================================\n');
    
    const proxyManager = new ProxyManager(CONFIG.proxies);
    const tokenExtractor = new TokenExtractor(proxyManager);
    
    try {
        console.log('1. Testing session initialization...');
        
        // Test session initialization
        const initResult = await tokenExtractor.initializeSession(
            CONFIG.irctc.username, 
            CONFIG.irctc.password
        );
        
        if (initResult.success) {
            console.log('✅ Session initialized successfully');
            console.log('📊 Initial tokens received:', !!initResult.tokens);
            console.log('🔑 Bearer token length:', initResult.tokens?.bearer?.length || 0);
        } else {
            console.log('❌ Session initialization failed:', initResult.error);
            return;
        }
        
        console.log('\n2. Testing token monitoring...');
        
        // Set up token update listener
        let tokenUpdateCount = 0;
        tokenExtractor.onTokenUpdate((newTokens) => {
            tokenUpdateCount++;
            console.log(`🔄 Token update #${tokenUpdateCount} received`);
            console.log('📊 New bearer token:', newTokens.bearer?.substring(0, 20) + '...');
        });
        
        console.log('✅ Token update listener registered');
        
        console.log('\n3. Testing manual token refresh...');
        
        // Wait a bit then test manual refresh
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const refreshResult = await tokenExtractor.refreshTokens();
        if (refreshResult) {
            console.log('✅ Manual token refresh successful');
            console.log('📊 Refreshed token:', refreshResult.bearer?.substring(0, 20) + '...');
        } else {
            console.log('❌ Manual token refresh failed');
        }
        
        console.log('\n4. Testing session persistence...');
        
        // Test getting latest tokens
        const latestTokens = tokenExtractor.getLatestTokens();
        if (latestTokens && latestTokens.bearer) {
            console.log('✅ Session is persistent - tokens available');
            console.log('📊 Current token:', latestTokens.bearer.substring(0, 20) + '...');
        } else {
            console.log('❌ Session persistence issue - no tokens available');
        }
        
        console.log('\n5. Monitoring for 30 seconds...');
        console.log('💡 Any automatic token updates will be shown below:');
        
        // Monitor for 30 seconds
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        console.log(`\n📊 Total token updates received: ${tokenUpdateCount}`);
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n6. Cleaning up...');
        await tokenExtractor.closeSession();
        console.log('✅ Session closed successfully');
    }
}

// Run the test
if (require.main === module) {
    testPersistentSession().catch(console.error);
}

module.exports = { testPersistentSession };