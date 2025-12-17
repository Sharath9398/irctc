// lib/mobile-automation.js
const { remote } = require('webdriverio');
const MainFlow = require('./irctc-flows/main-flow');

class MobileAutomation {
  constructor() {
    this.driver = null;
    this.isConnected = false;
    this.mainFlow = null;
  }

  /**
   * Connect to mobile device via Appium server
   */
  async connect() {
    try {
      const capabilities = {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': 'Android Device',
        'appium:noReset': true,
        'appium:fullReset': false,
        //'appium:avd': 'Medium_Phone',
        'appium:newCommandTimeout': 300
      };
      
      console.log('[Mobile] Using capabilities:', JSON.stringify(capabilities, null, 2));

      this.driver = await remote({
        protocol: 'http',
        hostname: 'localhost',
        port: 4723,
        path: '/',
        capabilities
      });

      this.isConnected = true;
      this.mainFlow = new MainFlow(this.driver);
      console.log('[Mobile] Connected to device successfully');
      return { success: true, message: 'Connected to mobile device' };

    } catch (error) {
      console.error('[Mobile] Connection failed:', error.message);
      this.isConnected = false;
      return { success: false, error: error.message };
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
   * Execute booking flow with CAPTCHA automation
   */
  async completeBookingFlow(credentials, ticketData, useAutoCaptcha = true) {
    if (!this.isConnected || !this.driver || !this.mainFlow) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    return await this.mainFlow.completeBooking(credentials, ticketData, useAutoCaptcha);
  }

  /**
   * Login with automatic CAPTCHA solving
   */
  async loginWithCaptcha(username, password, pin = null, useAutoCaptcha = true) {
    if (!this.isConnected || !this.driver) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    const LoginPage = require('./irctc-flows/login-page');
    const loginPage = new LoginPage(this.driver);
    
    return await loginPage.loginWithCaptcha(
      username, 
      password, 
      '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
      useAutoCaptcha
    );
  }
}

module.exports = MobileAutomation;