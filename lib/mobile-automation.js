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
   * Execute booking flow - delegates to MainFlow
   */
  async completeBookingFlow(credentials, ticketData) {
    if (!this.isConnected || !this.driver || !this.mainFlow) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    return await this.mainFlow.completeBooking(credentials, ticketData);
  }

  /**
   * Legacy method for backward compatibility
   */
  async loginWithCaptcha(username, password, pin = null) {
    const credentials = { username, password, pin };
    return await this.completeBookingFlow(credentials, {});
  }
}

module.exports = MobileAutomation;