// lib/irctc-flows/main-flow.js
const LoginPage = require('./login-page');
const GeneratePinPage = require('./generate-pin-page');

class MainFlow {
  constructor(driver) {
    this.driver = driver;
    this.loginPage = new LoginPage(driver);
    this.generatePinPage = new GeneratePinPage(driver);
  }

  async completeLogin(credentials) {
    try {
      console.log('[MainFlow] Starting complete login flow...');

      // Step 1: Login with captcha
      const loginResult = await this.loginPage.loginWithCaptcha(credentials.username, credentials.password);
      if (!loginResult.success) return loginResult;

      console.log('[MainFlow] Login successful, checking for PIN setup...');

      // Step 2: Check if PIN setup is required and handle it
      if (credentials.pin) {
        const pinResult = await this.generatePinPage.setupPin(credentials.pin);
        if (!pinResult.success) return pinResult;
        console.log('[MainFlow] PIN setup completed');
      }

      return { success: true, message: 'Complete login flow finished successfully' };

    } catch (error) {
      console.error('[MainFlow] Complete login failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MainFlow;