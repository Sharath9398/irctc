const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

class TokenExtractor {
    constructor(proxyManager) {
        this.proxyManager = proxyManager;
    }

    createProxyExtension(host, port, username, password) {
        const extensionPath = path.join(__dirname, 'proxy_auth_extension');
        if (!fs.existsSync(extensionPath)) fs.mkdirSync(extensionPath);

        const manifestJson = JSON.stringify({
            "version": "1.0.0",
            "manifest_version": 2,
            "name": "Chrome Proxy",
            "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
            "background": { "scripts": ["background.js"] },
            "minimum_chrome_version": "22.0.0"
        });

        const backgroundJs = `
            var config = {
                mode: "fixed_servers",
                rules: {
                    singleProxy: { scheme: "http", host: "${host}", port: parseInt(${port}) },
                    bypassList: []
                }
            };
            chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
            chrome.webRequest.onAuthRequired.addListener(
                function(details) {
                    return { authCredentials: { username: "${username}", password: "${password}" } };
                },
                {urls: ["<all_urls>"]},
                ["blocking"]
            );
        `;

        fs.writeFileSync(path.join(extensionPath, 'manifest.json'), manifestJson);
        fs.writeFileSync(path.join(extensionPath, 'background.js'), backgroundJs);
        return extensionPath;
    }

    async extractTokens(username, password) {
        let driver;
        try {
            const options = new chrome.Options();
            
            // Optimized Stealth Arguments
            options.addArguments('--disable-blink-features=AutomationControlled');
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            // Use a consistent modern User-Agent
            options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            options.excludeSwitches(['enable-automation']);

            const proxy = this.proxyManager.getCurrent();
            if (proxy && proxy.username) {
                const extPath = this.createProxyExtension(proxy.host, proxy.port, proxy.username, proxy.password);
                options.addArguments(`--load-extension=${extPath}`);
            } else if (proxy) {
                options.addArguments(`--proxy-server=http://${proxy.host}:${proxy.port}`);
            }
            
            driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
            
            // Optimized Sniffer Script (Captures both Request and Response Headers)
            const injectSniffer = async () => {
                await driver.executeScript(`
                    window.capturedTokens = window.capturedTokens || { bearer: null, greq: null, csrf: null, bmiyek: null, bmirak: null };
                    if (window.snifferActive) return;
                    window.snifferActive = true;

                    function captureFromRequest(headers, url) {
                        if (!url.includes('/mapps1/')) return;
                        const h = {};
                        for (let key in headers) h[key.toLowerCase()] = headers[key];
                        
                        if (h['authorization']) window.capturedTokens.bearer = h['authorization'].replace('Bearer ', '');
                        if (h['greq']) window.capturedTokens.greq = h['greq'];
                        if (h['spa-csrf-token']) window.capturedTokens.csrf = h['spa-csrf-token'];
                        if (h['bmiyek']) window.capturedTokens.bmiyek = h['bmiyek'];
                        if (h['bmirak']) window.capturedTokens.bmirak = h['bmirak'];
                    }

                    // Intercept Fetch
                    const orgFetch = window.fetch;
                    window.fetch = async function(res, init) {
                        const url = typeof res === 'string' ? res : res.url;
                        if (init && init.headers) captureFromRequest(init.headers, url);
                        
                        const response = await orgFetch.apply(this, arguments);
                        
                        // Extract CSRF from Response Headers if found
                        if (url.includes('/mapps1/')) {
                            const respCsrf = response.headers.get('spa-csrf-token') || response.headers.get('csrf-token');
                            if (respCsrf) window.capturedTokens.csrf = respCsrf;
                        }
                        return response;
                    };

                    // Intercept XHR
                    const orgXHR = window.XMLHttpRequest;
                    window.XMLHttpRequest = function() {
                        const xhr = new orgXHR();
                        const orgSend = xhr.send;
                        const orgSetHeader = xhr.setRequestHeader;
                        xhr._headers = {};

                        xhr.setRequestHeader = function(n, v) {
                            xhr._headers[n.toLowerCase()] = v;
                            return orgSetHeader.apply(this, arguments);
                        };

                        xhr.addEventListener('readystatechange', function() {
                            if (this.readyState === 4 && this._url && this._url.includes('/mapps1/')) {
                                const respCsrf = this.getResponseHeader('spa-csrf-token') || this.getResponseHeader('csrf-token');
                                if (respCsrf) window.capturedTokens.csrf = respCsrf;
                            }
                        });

                        const orgOpen = xhr.open;
                        xhr.open = function(m, u) { this._url = u; return orgOpen.apply(this, arguments); };
                        xhr.send = function() { 
                            captureFromRequest(this._headers || {}, this._url || ''); 
                            return orgSend.apply(this, arguments); 
                        };
                        return xhr;
                    };
                `);
            };

            await driver.get('https://www.irctc.co.in/nget/train-search');
            await injectSniffer();
            
            await this.performLogin(driver, username, password);
            await injectSniffer(); // Re-inject after login transition

            console.log('🔍 Extracting tokens...');
            let tokens = null;
            for (let i = 0; i < 20; i++) {
                await driver.sleep(1000);
                tokens = await driver.executeScript('return window.capturedTokens;');
                
                // Nudge if silent
                if (i === 5 && (!tokens || !tokens.bearer)) {
                    await driver.executeScript("fetch('/eticketing/protected/mapps1/validateUser?source=3', { headers: {'bmirak': 'webbm'} });");
                }

                if (tokens && tokens.bearer && tokens.greq) break;
            }

            const cookies = await driver.manage().getCookies();
            const akamaiCookie = cookies.find(c => c.name === '_abck');

            if (tokens && tokens.bearer) {
                if (!tokens.bmiyek && akamaiCookie) tokens.bmiyek = akamaiCookie.value;
                return {
                    success: true,
                    tokens,
                    cookies: cookies.map(c => `${c.name}=${c.value}`).join('; ')
                };
            }
            return { success: false, error: 'Required tokens (Bearer/GREQ) not captured.' };

        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            if (driver) await driver.quit();
        }
    }

    // Helper functions (keep original logic)
    async randomDelay(min, max) {
        await new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
    }

    async humanType(driver, element, text) {
        await element.clear();
        for (const char of text) {
            await element.sendKeys(char);
            await this.randomDelay(100, 250);
        }
    }

    async performLogin(driver, username, password) {
        try {
            const okBtn = await driver.wait(until.elementLocated(By.xpath("//button[text()='OK']")), 5000);
            await okBtn.click();
        } catch (e) {}

        const loginMenu = await driver.wait(until.elementLocated(By.css(".h_menu_drop_button.hidden-xs")), 5000);
        await loginMenu.click();
        
        const loginBtn = await driver.wait(until.elementLocated(By.xpath("//button[text()='LOGIN']")), 5000);
        await loginBtn.click();

        const userField = await driver.wait(until.elementLocated(By.css("[placeholder='User Name']")), 5000);
        await this.humanType(driver, userField, username);
        
        const passField = await driver.findElement(By.css("[placeholder='Password']"));
        await this.humanType(driver, passField, password);

        // Captcha loop
        for (let i = 0; i < 3; i++) {
            const captchaImg = await driver.wait(until.elementLocated(By.css('.captcha-img')), 5000);
            const b64 = (await captchaImg.getAttribute('src')).split(',')[1];
            const solved = await this.solveCaptcha(b64);
            
            if (solved && solved.success) {
                const captchaInput = await driver.findElement(By.css("[name='captcha']"));
                await this.humanType(driver, captchaInput, solved.text);
                await (await driver.findElement(By.xpath("//button[normalize-space()='SIGN IN']"))).click();
                
                await this.randomDelay(3000, 5000);
                try {
                    await driver.findElement(By.xpath("//span[contains(text(),'Last Transaction Detail')]"));
                    return; // Success
                } catch (e) {
                    // Retry or refresh captcha
                    const refresh = await driver.findElement(By.css('.glyphicon-repeat'));
                    await refresh.click();
                    await this.randomDelay(1000, 2000);
                }
            }
        }
        throw new Error("Failed to login after 3 attempts");
    }

    async solveCaptcha(base64Image) {
        try {
            const CaptchaSolver = require('./captcha-solver');
            const solver = new CaptchaSolver();
            const result = await solver.solveCaptcha(base64Image);
            await solver.terminate();
            return result;
        } catch (e) { return { success: false }; }
    }
}

module.exports = TokenExtractor;