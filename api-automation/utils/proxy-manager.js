// ProxyManager class - handles multiple proxy servers
class ProxyManager {
    constructor(proxies) {
        this.proxies = proxies;      // Array of proxy configurations
        this.currentIndex = 0;       // Index of currently active proxy
    }

    // Creates proxy URL with authentication credentials
    getProxyUrl(proxy) {
        return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }

    // Returns the currently active proxy configuration
    getCurrent() {
        return this.proxies[this.currentIndex];
    }

    // Switch to next proxy (for failover)
    switchToNext() {
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return this.getCurrent();
    }

    // Get current proxy info for logging
    getCurrentInfo() {
        const proxy = this.getCurrent();
        return `${proxy.name} (${proxy.host}:${proxy.port})`;
    }
}

module.exports = ProxyManager;