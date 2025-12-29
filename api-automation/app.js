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
        return await this.irctcService.login(username, password, captcha);
    }

    async fullLoginFlow() {
        try {
            console.log('Starting full login flow...');
            
            const captchaResult = await this.getCaptcha();
            if (!captchaResult.success) {
                return captchaResult;
            }
            
            const dummyCaptcha = 'ABCD';
            console.log('Using dummy captcha:', dummyCaptcha);
            
            const loginResult = await this.login(CONFIG.irctc.username, CONFIG.irctc.password, dummyCaptcha);
            
            return loginResult;
            
        } catch (error) {
            console.log('Full login flow failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

async function main() {
    try {
        const automation = new IRCTCAutomation();
        
        const handshakeResult = await automation.testHandshake();
        
        if (handshakeResult.success) {
            console.log('Handshake successful! Ready for login flow.');
        }
        
    } catch (error) {
        console.log('Application error:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = IRCTCAutomation;