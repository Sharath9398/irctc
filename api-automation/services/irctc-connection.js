// Import required packages
const axios = require('axios');                           // HTTP client for making API requests
const { HttpsProxyAgent } = require('https-proxy-agent'); // Routes HTTPS requests through proxy server
const { HttpProxyAgent } = require('http-proxy-agent');   // Routes HTTP requests through proxy server
const { CookieJar } = require('tough-cookie');            // Stores and manages cookies like a browser
const CONFIG = require('../config/config');

// IRCTCConnection class - manages connection to IRCTC with proxy and cookies
class IRCTCConnection {
    constructor(proxyManager) {
        this.proxyManager = proxyManager;
        this.cookieJar = new CookieJar();  // Creates cookie storage (like browser cookies)
        this.initClient();                 // Initialize the HTTP client
    }

    // Initialize axios HTTP client with proxy and cookie handling
    initClient() {
        const proxy = this.proxyManager.getCurrent();
        
        const clientConfig = {
            timeout: CONFIG.timeout,
            headers: {
                'User-Agent': CONFIG.userAgent
            },
            // Add retry configuration
            validateStatus: function (status) {
                return status < 500; // Resolve only if status is less than 500
            }
        };
        
        // Only add proxy if available
        if (proxy) {
            const proxyUrl = this.proxyManager.getProxyUrl(proxy);
            clientConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
            clientConfig.httpAgent = new HttpProxyAgent(proxyUrl);
        }

        this.client = axios.create(clientConfig);

        // Request interceptor - runs before every HTTP request
        this.client.interceptors.request.use((config) => {
            // Get stored cookies for this URL and add them to request headers
            const cookies = this.cookieJar.getCookiesSync(config.url || CONFIG.irctc.baseUrl);
            if (cookies.length > 0) {
                // Convert cookies to header format: "cookie1=value1; cookie2=value2"
                config.headers['Cookie'] = cookies.map(c => `${c.key}=${c.value}`).join('; ');
            }
            return config;
        });

        // Response interceptor - runs after every HTTP response
        this.client.interceptors.response.use((response) => {
            // Extract 'Set-Cookie' headers from server response
            const setCookies = response.headers['set-cookie'];
            if (setCookies) {
                // Store each cookie in our cookie jar for future requests
                setCookies.forEach(cookie => {
                    this.cookieJar.setCookieSync(cookie, response.config.url || CONFIG.irctc.baseUrl);
                });
            }
            return response;
        });
    }

    // Get all stored cookies for debugging
    getAllCookies() {
        return this.cookieJar.getCookiesSync(CONFIG.irctc.baseUrl);
    }

    // Clear all cookies (for fresh session)
    clearCookies() {
        this.cookieJar = new CookieJar();
    }
}

module.exports = IRCTCConnection;