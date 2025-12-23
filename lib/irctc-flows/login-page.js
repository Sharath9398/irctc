const CaptchaSolver = require('../captcha-solver');
const Locators = require('../locators');

class LoginPage {
  constructor(driver) {
    this.driver = driver;
    this.captchaSolver = new CaptchaSolver(driver);
  }

  /**
   * Helpers
   */
  async safeClick(element, timeout = 5000) {
    try {
      await element.waitForDisplayed({ timeout });
      await element.click();
      return true;
    } catch (e) {
      return false;
    }
  }

  async findAny(selectors, timeout = 2000) {
    const endTime = Date.now() + timeout;
    do {
      for (const sel of selectors) {
        try {
          const el = await this.driver.$(sel);
          if (await el.isExisting()) return el;
        } catch (e) { }
      }
      await this.driver.pause(200);
    } while (Date.now() < endTime);
    return null;
  }

  /**
   * Flows
   */

  async clickOkButton() {
    try {
      console.log('[LoginPage] Checking for OK button...');
      const btn = await this.driver.$(Locators.COMMON.BUTTON_1);
      // Short wait as it might not exist
      if (await this.safeClick(btn, 5000)) {
        console.log('[LoginPage] OK button clicked');
        await this.driver.pause(500); // Animation wait
        return { success: true };
      }
      return { success: false, error: 'OK button skipped' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async clickTopLoginButton() {
    try {
      console.log('[LoginPage] Waiting for top Login button...');

      // Try ID first
      let btn = await this.driver.$(Locators.LOGIN_PAGE.TOP_LOGIN_BUTTON_ID);
      let clicked = await this.safeClick(btn, 5000);

      // Fallback to text
      if (!clicked) {
        console.log('[LoginPage] Resource ID button not found, trying Text...');
        btn = await this.driver.$(Locators.LOGIN_PAGE.TOP_LOGIN_BUTTON_TEXT);
        clicked = await this.safeClick(btn, 5000);
      }

      if (clicked) {
        console.log('[LoginPage] Top Login button clicked successfully');
        await this.driver.pause(1000);
        return { success: true };
      }

      return { success: false, error: 'Top Login button not found or not clickable' };
    } catch (e) {
      return { success: false, error: `Top Login button error: ${e.message}` };
    }
  }

  async loginWithCaptcha(username, password, captchaImageSelector = null, useAutoCaptcha = false) {
    try {
      const credentialsResult = await this.enterCredentials(username, password);
      if (!credentialsResult.success) return credentialsResult;

      const captchaResult = await this.solveCaptchaAutomatically(captchaImageSelector);
      if (!captchaResult.success) return captchaResult;

      return await this.clickLoginButton();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async enterCredentials(username, password) {
    try {
      // 1. Username
      // Try the robust ID first (from Java code)
      let usernameField = await this.driver.$(Locators.LOGIN_PAGE.USERNAME_FIELD_ID);

      if (!(await usernameField.isExisting())) {
        // Fallback to legacy list
        usernameField = await this.findAny(Locators.LOGIN_PAGE.USERNAME_FIELD_FALLBACKS, 5000);
      }

      if (!usernameField || !(await usernameField.isExisting())) {
        throw new Error('Username field not found');
      }

      await usernameField.waitForDisplayed({ timeout: 5000 });
      await usernameField.click();
      await usernameField.clearValue();
      await usernameField.setValue(username);
      console.log('[LoginPage] Username entered');

      // 2. Password
      let passwordField = await this.findAny(Locators.LOGIN_PAGE.PASSWORD_FIELD_FALLBACKS, 5000);

      if (!passwordField) {
        throw new Error('Password field not found');
      }

      await passwordField.click();
      await passwordField.clearValue();
      await passwordField.setValue(password);
      console.log('[LoginPage] Password entered');

      // 3. Focus Captcha Input (Optional but recommended by legacy code)
      const captchaInput = await this.driver.$(Locators.LOGIN_PAGE.CAPTCHA_INPUT_ID);
      if (await this.safeClick(captchaInput, 3000)) {
        console.log('[LoginPage] Captcha field focused');
      }

      return { success: true, message: 'Credentials entered' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async solveCaptchaAutomatically(captchaImageSelector) {
    try {
      // Use locator from args or default
      const selector = captchaImageSelector || Locators.LOGIN_PAGE.CAPTCHA_IMAGE_ID;
      const result = await this.captchaSolver.solveCaptcha(selector);

      if (result.success) {
        const captchaField = await this.driver.$(Locators.LOGIN_PAGE.CAPTCHA_INPUT_ID);
        await captchaField.setValue(result.text);
        console.log('[LoginPage] CAPTCHA solved:', result.text);
        return { success: true, message: `CAPTCHA solved: ${result.text}` };
      }

      return { success: false, error: 'CAPTCHA OCR failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }


  async clickLoginButton() {
    try {
      const loginButton = await this.driver.$(Locators.LOGIN_PAGE.LOGIN_SUBMIT_BUTTON);

      if (!(await this.safeClick(loginButton, 5000))) {
        throw new Error('Login submit button not found');
      }

      console.log('[LoginPage] Login submit button clicked');

      // Wait for page transition or errors
      await this.checkForLoginErrorsOrSuccess();

      return { success: true, message: 'Login flow finished' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkForLoginErrorsOrSuccess() {
    // This part is tricky because success means leaving the page, failures mean staying.
    // We'll wait a bit.
    await this.driver.pause(1000);

    // Check for errors
    const errorMsg = await this.findAny(Locators.LOGIN_PAGE.ERROR_MESSAGES, 2000);
    if (errorMsg) {
      const text = await errorMsg.getText();
      console.log('[LoginPage] Login error detected:', text);
      throw new Error(`Login failed: ${text}`);
    }

    // Check if we are still on login page?
    const loginBtn = await this.driver.$(Locators.LOGIN_PAGE.LOGIN_SUBMIT_BUTTON);
    if (await loginBtn.isExisting()) {
      // If we are still here and no error found yet, wait a bit longer or assume success?
      // If the button exists, likely we haven't moved.
      console.log('[LoginPage] Warning: valid transition not confirmed, but no error detected yet.');
    } else {
      console.log('[LoginPage] Login transition likely successful.');
    }
  }
}

module.exports = LoginPage;