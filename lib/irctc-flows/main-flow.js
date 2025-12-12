// lib/irctc-flows/main-flow.js
const LoginPage = require('./login-page');
const GeneratePinPage = require('./generate-pin-page');
const RailConnectPage = require('./rail-connect-page');

class MainFlow {
  constructor(driver) {
    this.driver = driver;
    this.loginPage = new LoginPage(driver);
    this.generatePinPage = new GeneratePinPage(driver);
    this.railConnectPage = new RailConnectPage(driver);
  }

  async completeLogin(credentials) {
    try {


      // Step 1: Login with captcha
      const loginResult = await this.loginPage.loginWithCaptcha(credentials.username, credentials.password);
      if (!loginResult.success) return loginResult;



      // Step 2: Check if PIN setup is required and handle it
      if (credentials.pin) {
        const pinResult = await this.generatePinPage.setupPin(credentials.pin);
        if (!pinResult.success) return pinResult;

      }

      // Step 3: Click train button on rail connect page
      const trainResult = await this.railConnectPage.clickTrainButton();
      if (!trainResult.success) return trainResult;


      return { success: true, message: 'Complete login flow finished successfully' };

    } catch (error) {
      console.error('[MainFlow] Complete login failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MainFlow;