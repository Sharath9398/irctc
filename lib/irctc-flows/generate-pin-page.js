// lib/irctc-flows/generate-pin-page.js

class GeneratePinPage {
  constructor(driver) {
    this.driver = driver;
  }

  async setupPin(pin) {
    try {
      console.log('[GeneratePinPage] Setting up PIN...');

      // Wait for PIN page to appear (poll for up to 15 seconds)
      const pinPageExists = await this.waitForPinPage();
      if (!pinPageExists.success) {
        console.log('[GeneratePinPage] PIN page not found, skipping PIN setup');
        return { success: true, message: 'PIN setup not required or already completed' };
      }

      const enterPinResult = await this.enterPin(pin);
      if (!enterPinResult.success) return enterPinResult;

      const confirmPinResult = await this.confirmPin(pin);
      if (!confirmPinResult.success) return confirmPinResult;

      const submitResult = await this.clickSubmit();
      return submitResult;

    } catch (error) {
      console.error('[GeneratePinPage] PIN setup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async waitForPinPage() {
    try {
      console.log('[GeneratePinPage] Waiting for PIN page to appear...');
      
      const pinPageSelectors = [
        '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/et_pin"]',
        '//android.widget.TextView[contains(@text, "PIN")]',
        '//android.widget.TextView[contains(@text, "Create")]',
        '//android.widget.TextView[contains(@text, "Generate")]'
      ];
      
      // Poll for PIN page for up to 15 seconds
      let attempts = 0;
      const maxAttempts = 15; // 15 seconds
      
      while (attempts < maxAttempts) {
        for (const selector of pinPageSelectors) {
          try {
            const element = await this.driver.$(selector);
            if (await element.isExisting()) {
              console.log('[GeneratePinPage] PIN page detected after', attempts, 'seconds');
              return { success: true, message: 'PIN page found' };
            }
          } catch (e) {}
        }
        
        await this.driver.pause(1000); // Wait 1 second
        attempts++;
      }
      
      console.log('[GeneratePinPage] PIN page not found after 15 seconds');
      return { success: false, error: 'PIN page not found after waiting 15 seconds' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async enterPin(pin) {
    try {
      const enterPinSelectors = [
        '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/et_pin"]',
        '//android.widget.EditText[contains(@hint, "PIN")]',
        '//android.widget.EditText[1]'
      ];
      
      let enterPinField = null;
      for (const selector of enterPinSelectors) {
        try {
          enterPinField = await this.driver.$(selector);
          if (await enterPinField.isExisting()) {
            console.log('[GeneratePinPage] Found enter PIN field');
            break;
          }
        } catch (e) {}
      }
      
      if (!enterPinField || !(await enterPinField.isExisting())) {
        throw new Error('Enter PIN field not found');
      }

      await enterPinField.click();
      await this.driver.pause(500);
      await enterPinField.clearValue();
      await enterPinField.setValue(pin);
      console.log('[GeneratePinPage] PIN entered');

      return { success: true, message: 'PIN entered successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async confirmPin(pin) {
    try {
      const confirmPinSelectors = [
        '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/et_re_enter_pin"]',
        '//android.widget.EditText[contains(@hint, "Confirm")]',
        '//android.widget.EditText[2]'
      ];
      
      let confirmPinField = null;
      for (const selector of confirmPinSelectors) {
        try {
          confirmPinField = await this.driver.$(selector);
          if (await confirmPinField.isExisting()) {
            console.log('[GeneratePinPage] Found confirm PIN field');
            break;
          }
        } catch (e) {}
      }
      
      if (!confirmPinField || !(await confirmPinField.isExisting())) {
        throw new Error('Confirm PIN field not found');
      }

      await confirmPinField.click();
      await this.driver.pause(500);
      await confirmPinField.clearValue();
      await confirmPinField.setValue(pin);
      console.log('[GeneratePinPage] PIN confirmed');

      return { success: true, message: 'PIN confirmed successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickSubmit() {
    try {
      const submitSelector = '//android.widget.TextView[@text="SUBMIT"]';
      
      const submitButton = await this.driver.$(submitSelector);
      if (!(await submitButton.isExisting())) {
        throw new Error('Submit button not found');
      }
      
      await submitButton.click();
      console.log('[GeneratePinPage] Submit button clicked');
      
      await this.driver.pause(3000);
      
      console.log('[GeneratePinPage] PIN setup completed successfully');
      return { success: true, message: 'PIN setup completed successfully' };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = GeneratePinPage;