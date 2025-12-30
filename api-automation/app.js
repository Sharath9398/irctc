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
}

async function main() {
    try {
        const automation = new IRCTCAutomation();
        
        const handshakeResult = await automation.testHandshake();
        
        if (handshakeResult.success) {
            console.log('✅ Handshake successful! Ready for login flow.');
            
            const loginResult = await automation.performLogin();
            
            if (loginResult.success) {
                console.log('✅ Login completed successfully!');
                console.log('Session tokens:', loginResult.tokens);
            } else {
                console.log('❌ Login failed:', loginResult.error);
            }
            
            console.log('\n📊 Session Info:', automation.getSessionInfo());
        }
        
    } catch (error) {
        console.log('❌ Application error:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = IRCTCAutomation;