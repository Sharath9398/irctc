// Configuration object - stores all settings for IRCTC automation
const CONFIG = {
    // Proxy server configurations (disabled)
    proxies: [],
    
    // IRCTC website settings
    irctc: {
        baseUrl: 'https://www.irctc.co.in',  // IRCTC website base URL
        username: 'rs9083954',               // IRCTC login username
        password: 'Gs2001920@@@'             // IRCTC login password
    },
    
    // HTTP client settings
    timeout: 30000,  // Request timeout in milliseconds (30 seconds)
    
    // Browser simulation settings
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

module.exports = CONFIG;