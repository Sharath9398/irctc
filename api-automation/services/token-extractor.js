const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class TokenExtractor {
    constructor(proxyManager) {
        this.driver = null;
        this.proxyManager = proxyManager;
        this.currentTokens = { bearer: null, greq: null, csrf: null, bmiyek: null, bmirak: null };
        this.isActive = false;
        this.tokenUpdateCallbacks = [];
    }

    async initializeSession(username, password) {
        try {
            console.log('🚀 Initializing live browser session...');
            
            const options = new chrome.Options();
            options.addArguments('--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled');
            options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            options.addArguments('--incognito');
            options.setUserPreferences({ 'profile.default_content_setting_values.notifications': 2 });

            if (this.proxyManager && this.proxyManager.getCurrentProxy && this.proxyManager.getCurrentProxy()) {
                const proxy = this.proxyManager.getCurrentProxy();
                options.addArguments(`--proxy-server=${proxy.host}:${proxy.port}`);
                console.log(`🌐 Using proxy: ${proxy.host}:${proxy.port}`);
            }

            this.driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
            await this.driver.manage().window().maximize();
            
            console.log('🌐 Navigating to IRCTC...');
            await this.driver.get('https://www.irctc.co.in/nget/train-search');
            await this.randomDelay(3000, 5000);

            await this.injectSniffer();
            await this.performLogin(this.driver, username, password);
            
            console.log('🔍 Extracting authentication tokens...');
            await this.driver.executeScript(`window.scrollBy(0, 10); window.scrollBy(0, -10);`);
            
            await new Promise(r => setTimeout(r, 2000));
            const tokens = await this.waitForTokens(5);
            
            if (!tokens || !tokens.bearer || !tokens.csrf) {
                throw new Error('Failed to extract required tokens');
            }

            this.currentTokens = tokens;
            this.isActive = true;
            this.startTokenMonitoring();

            const cookieString = await this.getCookieString();
            
            console.log('✅ Session initialized successfully');
            console.log('🎫 Tokens extracted:', {
                bearer: tokens.bearer.substring(0, 8) + '...',
                csrf: tokens.csrf ? 'present' : 'missing',
                greq: tokens.greq ? 'present' : 'missing'
            });

            return { success: true, tokens, cookies: cookieString };
        } catch (error) {
            console.error('❌ Session initialization failed:', error.message);
            if (this.driver) await this.driver.quit();
            return { success: false, error: error.message };
        }
    }

    async getCookieString() {
        if (!this.driver) return null;
        const cookies = await this.driver.manage().getCookies();
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }

    startTokenMonitoring() {
        const checkTokens = async () => {
            try {
                if (!this.driver || !this.isActive) return;
                
                const tokens = await this.driver.executeScript('return window.capturedTokens;');
                if (tokens && tokens.bearer && tokens.csrf && tokens.greq) {
                    if (JSON.stringify(tokens) !== JSON.stringify(this.currentTokens)) {
                        console.log('🔄 Token update detected');
                        this.currentTokens = tokens;
                        this.tokenUpdateCallbacks.forEach(cb => cb(tokens));
                    }
                }
            } catch (error) {
                console.error('Token monitoring error:', error);
            }
            
            if (this.isActive) {
                setTimeout(checkTokens, 2000);
            }
        };
        
        setTimeout(checkTokens, 2000);
    }

    onTokenUpdate(callback) {
        this.tokenUpdateCallbacks.push(callback);
    }

    getLatestTokens() {
        return this.currentTokens;
    }

    async getFreshTokensForBooking() {
        if (!this.driver || !this.isActive) return null;
        console.log('🔄 Creating fresh session fork for booking...');
        
        try {
            // Navigate to booking page to trigger fresh context
            await this.driver.get('https://www.irctc.co.in/nget/booking/psgninput');
            await new Promise(r => setTimeout(r, 2000));
            
            // Clear tokens and wait for fresh ones
            await this.driver.executeScript(`window.capturedTokens = { bearer: null, greq: null, csrf: null };`);
            
            // Minimal UI interaction to trigger token refresh
            await this.driver.executeScript(`
                document.body.click();
                window.scrollTo(0, 1);
            `);
            
            // Wait for fresh tokens
            await new Promise(r => setTimeout(r, 1500));
            const tokens = await this.driver.executeScript('return window.capturedTokens;');
            
            if (tokens && tokens.bearer && tokens.greq && tokens.csrf) {
                console.log('✅ Fresh booking tokens captured');
                this.currentTokens = tokens;
                return tokens;
            }
            
            return null;
        } catch (error) {
            console.log('❌ Fresh token error:', error.message);
            return null;
        }
    }

    async refreshTokens() {
        if (!this.driver || !this.isActive) return null;
        console.log('🔄 JIT Sync: Capturing high-speed tokens for booking...');
        try {
            // 1. Clear used tokens
            await this.driver.executeScript(`window.capturedTokens = { bearer: null, greq: null, csrf: null };`);

            // 2. UI Nudge to trigger IRCTC's internal preparation
            await this.driver.executeScript(`
                window.scrollTo(0, 10); 
                setTimeout(() => window.scrollTo(0, 0), 50);
            `);

            // 3. Brief wait for natural heartbeat
            let tokens = await this.waitForTokens(5); 
            if (tokens && tokens.bearer) {
                console.log('✅ JIT Tokens captured naturally');
                return tokens;
            }

            // 4. Fallback: Force a fresh context via fetch but wait for rotation
            console.log('🔄 Triggering forced rotation...');
            await this.driver.executeScript("fetch('https://www.irctc.co.in/eticketing/protected/mapps1/validateUser?source=3', { headers: {'bmirak': 'webbm'} }).catch(()=>{});");
            
            // Wait for the rotation that happens AFTER the fetch
            await new Promise(r => setTimeout(r, 2000));
            return await this.waitForTokens(5);
        } catch (error) { return null; }
    }

    async waitForTokens(attempts) {
        for (let i = 0; i < attempts; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const tokens = await this.driver.executeScript('return window.capturedTokens;');
            if (tokens && tokens.bearer && tokens.csrf && tokens.greq) {
                console.log(`✅ Valid tokens found on attempt ${i + 1}`);
                return tokens;
            }
        }
        console.log('❌ No valid tokens found after', attempts, 'attempts');
        return null;
    }

    async closeSession() {
        this.isActive = false;
        this.tokenUpdateCallbacks = [];
        
        if (this.driver) {
            await this.driver.quit();
            this.driver = null;
        }
        
        console.log('🔒 Session closed');
    }

    async injectSniffer() {
        if (!this.driver) return;
        
        await this.driver.executeScript(`
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

            const orgFetch = window.fetch;
            window.fetch = async function(res, init) {
                const url = typeof res === 'string' ? res : res.url;
                if (init && init.headers) captureFromRequest(init.headers, url);
                
                const response = await orgFetch.apply(this, arguments);
                
                if (url.includes('/mapps1/')) {
                    const respCsrf = response.headers.get('spa-csrf-token') || response.headers.get('csrf-token');
                    if (respCsrf) window.capturedTokens.csrf = respCsrf;
                }
                return response;
            };

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
    }

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
        
        let loginBtn;
        try {
            loginBtn = await driver.wait(until.elementLocated(By.xpath("//button[text()='LOGIN']")), 3000);
        } catch (e) {
            try {
                loginBtn = await driver.wait(until.elementLocated(By.xpath("//button[contains(text(),'LOGIN')]")), 3000);
            } catch (e2) {
                loginBtn = await driver.wait(until.elementLocated(By.css("button[type='button']")), 3000);
            }
        }
        await loginBtn.click();

        const userField = await driver.wait(until.elementLocated(By.css("[placeholder='User Name']")), 5000);
        await this.humanType(driver, userField, username);
        
        const passField = await driver.findElement(By.css("[placeholder='Password']"));
        await this.humanType(driver, passField, password);

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
                    return;
                } catch (e) {
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