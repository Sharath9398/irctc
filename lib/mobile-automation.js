// lib/mobile-automation.js
const { remote } = require('webdriverio');
const MainFlow = require('./irctc-flows/main-flow');

class MobileAutomation {
  constructor() {
    this.driver = null;
    this.isConnected = false;
    this.mainFlow = null;
    this.connectionRetries = 0;
    this.maxRetries = 3;
  }

  /**
   * Connect to mobile device via Appium server with retry mechanism
   */
  async connect() {
    try {
      const capabilities = {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': 'Android Device',
        'appium:noReset': true,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 300,
        'appium:uiautomator2ServerInstallTimeout': 60000,
        'appium:uiautomator2ServerLaunchTimeout': 60000
      };
      
      console.log('[Mobile] Using capabilities:', JSON.stringify(capabilities, null, 2));

      this.driver = await remote({
        protocol: 'http',
        hostname: 'localhost',
        port: 4723,
        path: '/',
        capabilities,
        connectionRetryCount: 3,
        connectionRetryTimeout: 30000
      });

      this.isConnected = true;
      this.mainFlow = new MainFlow(this.driver);
      this.connectionRetries = 0;
      console.log('[Mobile] Connected to device successfully');
      return { success: true, message: 'Connected to mobile device' };

    } catch (error) {
      console.error('[Mobile] Connection failed:', error.message);
      this.isConnected = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if driver is still responsive and reconnect if needed
   */
  async ensureConnection() {
    try {
      if (!this.driver || !this.isConnected) {
        throw new Error('Driver not connected');
      }
      
      // Test driver responsiveness
      await this.driver.getPageSource();
      return { success: true };
    } catch (error) {
      console.log('[Mobile] Connection lost, attempting to reconnect...');
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        await this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        const reconnectResult = await this.connect();
        
        if (reconnectResult.success) {
          console.log(`[Mobile] Reconnected successfully (attempt ${this.connectionRetries}/${this.maxRetries})`);
          return { success: true };
        }
      }
      
      return { success: false, error: 'Failed to restore connection after ' + this.maxRetries + ' attempts' };
    }
  }

  /**
   * Disconnect from mobile device
   */
  async disconnect() {
    try {
      if (this.driver) {
        await this.driver.deleteSession();
        this.driver = null;
      }
      this.isConnected = false;
      this.mainFlow = null;
      console.log('[Mobile] Disconnected from device');
      return { success: true };
    } catch (error) {
      console.error('[Mobile] Disconnect error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute booking flow with CAPTCHA automation and connection recovery
   */
  async completeBookingFlow(credentials, ticketData, useAutoCaptcha = true) {
    // Ensure connection is stable before starting
    const connectionCheck = await this.ensureConnection();
    if (!connectionCheck.success) {
      return { success: false, error: 'Connection check failed: ' + connectionCheck.error };
    }

    if (!this.isConnected || !this.driver || !this.mainFlow) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    try {
      const result = await this.mainFlow.completeBooking(credentials, ticketData, useAutoCaptcha);
      
      // Reset retry counter on successful completion
      this.connectionRetries = 0;
      
      return result;
    } catch (error) {
      // Check if error is due to connection issues
      if (error.message.includes('UiAutomator2') || error.message.includes('instrumentation process')) {
        console.log('[Mobile] Detected UiAutomator2 crash, attempting recovery...');
        
        const recoveryResult = await this.ensureConnection();
        if (recoveryResult.success) {
          console.log('[Mobile] Connection recovered, retrying booking flow...');
          return await this.mainFlow.completeBooking(credentials, ticketData, useAutoCaptcha);
        } else {
          return { success: false, error: 'UiAutomator2 crashed and recovery failed: ' + recoveryResult.error };
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Login with automatic CAPTCHA solving and connection recovery
   */
  async loginWithCaptcha(username, password, pin = null, useAutoCaptcha = true) {
    // Ensure connection is stable before starting
    const connectionCheck = await this.ensureConnection();
    if (!connectionCheck.success) {
      return { success: false, error: 'Connection check failed: ' + connectionCheck.error };
    }

    if (!this.isConnected || !this.driver) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    const LoginPage = require('./irctc-flows/login-page');
    const loginPage = new LoginPage(this.driver);
    
    try {
      const result = await loginPage.loginWithCaptcha(
        username, 
        password, 
        '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
        useAutoCaptcha
      );
      
      // Reset retry counter on successful completion
      this.connectionRetries = 0;
      
      return result;
    } catch (error) {
      // Check if error is due to connection issues
      if (error.message.includes('UiAutomator2') || error.message.includes('instrumentation process')) {
        console.log('[Mobile] Detected UiAutomator2 crash during login, attempting recovery...');
        
        const recoveryResult = await this.ensureConnection();
        if (recoveryResult.success) {
          console.log('[Mobile] Connection recovered, retrying login...');
          const newLoginPage = new LoginPage(this.driver);
          return await newLoginPage.loginWithCaptcha(
            username, 
            password, 
            '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
            useAutoCaptcha
          );
        } else {
          return { success: false, error: 'UiAutomator2 crashed during login and recovery failed: ' + recoveryResult.error };
        }
      }
      
      return { success: false, error: error.message };
    }
  }
}

module.exports = MobileAutomation;