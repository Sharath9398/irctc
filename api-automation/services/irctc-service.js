const CONFIG = require('../config/config');

class IRCTCService {
    constructor(connection) {
        this.connection = connection;
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
            
            try {
                await this.connection.client.post(`${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginAction`, {
                    userPrincipal: 'test',
                    password: 'test',
                    captcha: 'test'
                });
            } catch (error) {
                console.log('Login endpoint accessible, status:', error.response?.status);
            }
            
            console.log('IRCTC handshake successful');
            return { success: true };
            
        } catch (error) {
            console.log('IRCTC handshake failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getCaptcha() {
        try {
            const response = await this.connection.client.get(`${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginCaptcha`, {
                responseType: 'arraybuffer'
            });
            
            return {
                success: true,
                captchaImage: Buffer.from(response.data),
                size: response.data.byteLength
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async login(username, password, captcha) {
        try {
            const loginData = {
                userPrincipal: username,
                password: password,
                captcha: captcha
            };
            
            const response = await this.connection.client.post(
                `${CONFIG.irctc.baseUrl}/eticketing/protected/mapps1/loginAction`,
                loginData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Referer': `${CONFIG.irctc.baseUrl}/nget/train-search`,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );
            
            if (response.data && response.data.status === 'success') {
                return {
                    success: true,
                    message: 'Login successful',
                    data: response.data
                };
            } else {
                return {
                    success: false,
                    message: response.data?.message || 'Login failed'
                };
            }
            
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error_description || error.message
            };
        }
    }
}

module.exports = IRCTCService;