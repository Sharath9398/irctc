const CaptchaSolver = require('../captcha-solver');

class LoginPage {
  constructor(driver) {
    this.driver = driver;
    this.captchaSolver = new CaptchaSolver(driver);
  }

  async clickOkButton() {
    try {
      // Corresponds to user's clickButton() for android:id/button1
      const btnSelector = '//android.widget.Button[@resource-id="android:id/button1"]';
      console.log('[LoginPage] Checking for OK button...');

      // Attempt with timeout
      const button = await this.driver.$(btnSelector);
      await button.waitForExist({ timeout: 10000 }); // reduced from 30s to 10s for better UX if not present

      if (await button.isExisting()) {
        await button.click();
        console.log('[LoginPage] OK button clicked successfully');
        await this.driver.pause(1000);
        return { success: true };
      }
      return { success: false, error: 'OK button not found' };
    } catch (e) {
      // It's acceptable for this to fail if the button isn't there
      return { success: false, error: e.message };
    }
  }

  async clickTopLoginButton() {
    try {
      // Corresponds to user's clickLoginButton() for tv_action_right1
      // Fallback to text="LOGIN" if resource-id not found
      const selectors = [
        '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_action_right1"]',
        '//android.widget.TextView[@text="LOGIN"]'
      ];

      console.log('[LoginPage] Waiting for top Login button...');

      let button = null;
      for (const sel of selectors) {
        try {
          const el = await this.driver.$(sel);
          if (await el.isExisting()) {
            button = el;
            break;
          }
        } catch (e) { }
      }

      if (button) {
        // Wait briefly to ensure clickable
        await button.waitForExist({ timeout: 5000 });
        await button.click();
        console.log('[LoginPage] Top Login button clicked successfully');
        await this.driver.pause(1000);
        return { success: true };
      }

      // If we reach here, neither selector worked
      return { success: false, error: 'Top Login button found but not clickable or missing' };
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

      return await this.clickLoginButton(); // This clicks the submitting login button
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async enterCredentials(username, password) {
    try {
      // Quick retry for username field
      const usernameSelectors = [
        '//android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.RelativeLayout[1]/android.widget.LinearLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout//android.widget.EditText',
        '//android.widget.EditText[1]',
        'android=new UiSelector().className("android.widget.EditText").instance(0)'
      ];

      // Retry mechanism for username - try up to 15 times with 200ms intervals
      let attempts = 0;
      const maxAttempts = 15;
      let usernameField = null;

      while (attempts < maxAttempts && !usernameField) {
        for (const selector of usernameSelectors) {
          try {
            const field = await this.driver.$(selector);
            if (await field.isExisting()) {
              usernameField = field;
              console.log('[LoginPage] Username field found, typing immediately');
              break;
            }
          } catch (e) { }
        }

        if (!usernameField) {
          await this.driver.pause(200);
          attempts++;
        }
      }

      if (!usernameField) {
        throw new Error('Username field not found after retries');
      }

      await usernameField.click();
      await usernameField.clearValue();
      await usernameField.setValue(username);
      console.log('[LoginPage] Username entered successfully');

      // Quick retry for password field
      const passwordSelectors = [
        '//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/til_password"]//android.widget.EditText',
        '//android.widget.EditText[2]',
        'android=new UiSelector().className("android.widget.EditText").instance(1)'
      ];

      // Retry mechanism for password - try up to 10 times with 200ms intervals
      attempts = 0;
      const maxPasswordAttempts = 10;
      let passwordField = null;

      while (attempts < maxPasswordAttempts && !passwordField) {
        for (const selector of passwordSelectors) {
          try {
            const field = await this.driver.$(selector);
            if (await field.isExisting()) {
              passwordField = field;
              console.log('[LoginPage] Password field found, typing immediately');
              break;
            }
          } catch (e) { }
        }

        if (!passwordField) {
          await this.driver.pause(200);
          attempts++;
        }
      }

      if (!passwordField) {
        throw new Error('Password field not found after retries');
      }

      await passwordField.click();
      await passwordField.clearValue();
      await passwordField.setValue(password);
      console.log('[LoginPage] Password entered successfully');

      // Quick retry for CAPTCHA field focus
      console.log('[LoginPage] Clicking CAPTCHA input field after password entry');
      const captchaInputSelector = '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/tv_captcha_input"]';

      attempts = 0;
      const maxCaptchaAttempts = 5;

      while (attempts < maxCaptchaAttempts) {
        try {
          const captchaField = await this.driver.$(captchaInputSelector);
          if (await captchaField.isExisting()) {
            await captchaField.click();
            console.log('[LoginPage] CAPTCHA field clicked and focused immediately');
            break;
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      return { success: true, message: 'Credentials entered successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async solveCaptchaAutomatically(captchaImageSelector) {
    try {
      const result = await this.captchaSolver.solveCaptcha(captchaImageSelector);

      if (result.success) {
        const captchaField = await this.driver.$('//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/tv_captcha_input"]');
        await captchaField.setValue(result.text);
        console.log('[LoginPage] CAPTCHA solved:', result.text);
        return { success: true, message: `CAPTCHA solved: ${result.text}` };
      }

      return { success: false, error: 'CAPTCHA OCR failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async waitForCaptchaInput() {
    try {
      const captchaSelector = '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/tv_captcha_input"]';

      // Fast retry - check every 200ms for up to 30 seconds
      let attempts = 0;
      const maxAttempts = 150; // 30 seconds at 200ms intervals

      while (attempts < maxAttempts) {
        try {
          const captchaField = await this.driver.$(captchaSelector);
          if (await captchaField.isExisting()) {
            const captchaText = await captchaField.getText();
            if (captchaText && captchaText.trim().length > 0) {
              console.log('[LoginPage] Captcha entered by user immediately');
              await this.driver.pause(500); // Brief confirmation wait
              return { success: true, message: 'Captcha entered by user' };
            }
          }
        } catch (e) { }

        await this.driver.pause(200); // Quick 200ms check
        attempts++;
      }

      throw new Error('30 second timeout - captcha not entered');

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickLoginButton() {
    try {
      const loginSelector = '//android.widget.TextView[@text="LOGIN"]';

      // Retry mechanism for login button - try up to 10 times with 300ms intervals
      let attempts = 0;
      const maxAttempts = 10;
      let loginButton = null;

      while (attempts < maxAttempts && !loginButton) {
        try {
          const button = await this.driver.$(loginSelector);
          if (await button.isExisting()) {
            loginButton = button;
            console.log('[LoginPage] Login button found, clicking immediately');
            break;
          }
        } catch (e) { }

        await this.driver.pause(300);
        attempts++;
      }

      if (!loginButton) {
        throw new Error('Login button not found after retries');
      }

      await loginButton.click();
      console.log('[LoginPage] Login button clicked successfully');

      // Wait for page transition after login
      console.log('[LoginPage] Waiting for page transition after login...');
      await this.waitForLoginTransition();

      // Quick error check with retry - check every 300ms for up to 3 seconds
      attempts = 0;
      const maxErrorCheckAttempts = 10;

      while (attempts < maxErrorCheckAttempts) {
        // Check for errors
        const errorSelectors = [
          '//android.widget.TextView[contains(@text, "Invalid")]',
          '//android.widget.TextView[contains(@text, "Error")]',
          '//android.widget.TextView[contains(@text, "Failed")]',
          '//android.widget.TextView[contains(@text, "incorrect")]'
        ];

        for (const selector of errorSelectors) {
          try {
            const errorElement = await this.driver.$(selector);
            if (await errorElement.isExisting()) {
              const errorText = await errorElement.getText();
              console.log('[LoginPage] Login error detected:', errorText);
              return { success: false, error: `Login failed: ${errorText}` };
            }
          } catch (e) { }
        }

        // Check if still on login screen
        try {
          const stillOnLogin = await this.driver.$(loginSelector);
          if (!(await stillOnLogin.isExisting())) {
            // Login successful - no longer on login screen
            console.log('[LoginPage] Login completed successfully');
            return { success: true, message: 'Login completed successfully' };
          }
        } catch (e) { }

        await this.driver.pause(300);
        attempts++;
      }

      // Final check after all attempts
      try {
        const stillOnLogin = await this.driver.$(loginSelector);
        if (await stillOnLogin.isExisting()) {
          console.log('[LoginPage] Still on login screen after timeout');
          return { success: false, error: 'Login failed - still on login screen. Check captcha or credentials.' };
        }
      } catch (e) { }

      console.log('[LoginPage] Login completed successfully');
      return { success: true, message: 'Login completed successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async waitForLoginTransition() {
    try {
      // Wait for login transition to complete
      let attempts = 0;
      const maxAttempts = 50; // 10 seconds at 200ms intervals

      while (attempts < maxAttempts) {
        try {
          // Check if we're no longer on login page
          const loginButton = await this.driver.$('//android.widget.TextView[@text="LOGIN"]');
          if (!(await loginButton.isExisting())) {
            console.log('[LoginPage] Login transition completed - no longer on login page');
            return { success: true, message: 'Login transition completed' };
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      console.log('[LoginPage] Login transition timeout - proceeding with validation');
      return { success: true, message: 'Login transition timeout - proceeding' };
    } catch (error) {
      console.log('[LoginPage] Login transition check failed - proceeding anyway');
      return { success: true, message: 'Login transition check failed - proceeding' };
    }
  }
}

module.exports = LoginPage;