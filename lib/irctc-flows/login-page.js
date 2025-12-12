// lib/irctc-flows/login-page.js

class LoginPage {
  constructor(driver) {
    this.driver = driver;
  }

  async loginWithCaptcha(username, password) {
    try {


      const credentialsResult = await this.enterCredentials(username, password);
      if (!credentialsResult.success) return credentialsResult;

      const captchaResult = await this.waitForCaptchaInput();
      if (!captchaResult.success) return captchaResult;

      const loginResult = await this.clickLoginButton();
      return loginResult;

    } catch (error) {
      console.error('[LoginPage] Login failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async enterCredentials(username, password) {
    try {
      await this.driver.pause(3000);

      // Enter username
      const usernameSelectors = [
        '//android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.RelativeLayout[1]/android.widget.LinearLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout//android.widget.EditText',
        '//android.widget.EditText[1]',
        'android=new UiSelector().className("android.widget.EditText").instance(0)'
      ];

      let usernameField = null;
      for (const selector of usernameSelectors) {
        try {
          usernameField = await this.driver.$(selector);
          if (await usernameField.isExisting()) {

            break;
          }
        } catch (e) {}
      }

      if (!usernameField || !(await usernameField.isExisting())) {
        throw new Error('Username field not found');
      }

      await usernameField.click();
      await this.driver.pause(500);
      await usernameField.clearValue();
      await usernameField.setValue(username);


      // Enter password
      const passwordSelectors = [
        '//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/til_password"]//android.widget.EditText',
        '//android.widget.EditText[2]',
        'android=new UiSelector().className("android.widget.EditText").instance(1)'
      ];

      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await this.driver.$(selector);
          if (await passwordField.isExisting()) {

            break;
          }
        } catch (e) {}
      }

      if (!passwordField || !(await passwordField.isExisting())) {
        throw new Error('Password field not found');
      }

      await passwordField.click();
      await this.driver.pause(500);
      await passwordField.clearValue();
      await passwordField.setValue(password);


      return { success: true, message: 'Credentials entered successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async waitForCaptchaInput() {
    try {
      const captchaSelector = '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/tv_captcha_input"]';
      

      
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        try {
          const captchaField = await this.driver.$(captchaSelector);
          if (await captchaField.isExisting()) {
            const captchaText = await captchaField.getText();
            if (captchaText && captchaText.trim().length > 0) {

              await this.driver.pause(2000);
              return { success: true, message: 'Captcha entered by user' };
            }
          }
        } catch (e) {}
        
        await this.driver.pause(1000);
        attempts++;
      }
      
      throw new Error('10 second timeout - captcha not entered');
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickLoginButton() {
    try {
      const loginSelector = '//android.widget.TextView[@text="LOGIN"]';
      
      const loginButton = await this.driver.$(loginSelector);
      if (!(await loginButton.isExisting())) {
        throw new Error('Login button not found');
      }
      
      await loginButton.click();

      
      await this.driver.pause(3000);
      
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

            return { success: false, error: `Login failed: ${errorText}` };
          }
        } catch (e) {}
      }
      
      // Check if still on login screen
      try {
        const stillOnLogin = await this.driver.$(loginSelector);
        if (await stillOnLogin.isExisting()) {

          return { success: false, error: 'Login failed - still on login screen. Check captcha or credentials.' };
        }
      } catch (e) {}
      

      return { success: true, message: 'Login completed successfully' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LoginPage;