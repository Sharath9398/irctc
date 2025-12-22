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
      if (!submitResult.success) return submitResult;

      const okResult = await this.clickOkButton();
      return okResult;


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
      
      // Quick retry mechanism - check every 200ms for up to 7 seconds
      let attempts = 0;
      const maxAttempts = 35; // 7 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        for (const selector of pinPageSelectors) {
          try {
            const element = await this.driver.$(selector);
            if (await element.isExisting()) {
              console.log('[GeneratePinPage] PIN page found immediately');
              return { success: true, message: 'PIN page found' };
            }
          } catch (e) {}
        }
        
        await this.driver.pause(200); // Quick 200ms check
        attempts++;
      }
      
      return { success: false, error: 'PIN page not found after waiting 7 seconds' };
      
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
      
      // Retry mechanism - try up to 10 times with 300ms intervals
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        for (const selector of enterPinSelectors) {
          try {
            const enterPinField = await this.driver.$(selector);
            if (await enterPinField.isExisting()) {
              console.log('[GeneratePinPage] Enter PIN field found, typing immediately');
              await enterPinField.click();
              await enterPinField.clearValue();
              await enterPinField.setValue(pin);
              console.log('[GeneratePinPage] PIN entered successfully');
              return { success: true, message: 'PIN entered successfully' };
            }
          } catch (e) {}
        }
        
        await this.driver.pause(300);
        attempts++;
      }
      
      throw new Error('Enter PIN field not found after retries');

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
      
      // Retry mechanism - try up to 10 times with 300ms intervals
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        for (const selector of confirmPinSelectors) {
          try {
            const confirmPinField = await this.driver.$(selector);
            if (await confirmPinField.isExisting()) {
              console.log('[GeneratePinPage] Confirm PIN field found, typing immediately');
              await confirmPinField.click();
              await confirmPinField.clearValue();
              await confirmPinField.setValue(pin);
              console.log('[GeneratePinPage] PIN confirmed successfully');
              return { success: true, message: 'PIN confirmed successfully' };
            }
          } catch (e) {}
        }
        
        await this.driver.pause(300);
        attempts++;
      }
      
      throw new Error('Confirm PIN field not found after retries');

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickSubmit() {
    try {
      const submitSelector = '//android.widget.TextView[@text="SUBMIT"]';
      
      // Retry mechanism - try up to 10 times with 300ms intervals
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        try {
          const submitButton = await this.driver.$(submitSelector);
          if (await submitButton.isExisting()) {
            console.log('[GeneratePinPage] Submit button found, clicking immediately');
            await submitButton.click();
            console.log('[GeneratePinPage] Submit button clicked successfully');
            await this.driver.pause(1000); // Brief wait for response
            return { success: true, message: 'Submit button clicked successfully' };
          }
        } catch (e) {}
        
        await this.driver.pause(300);
        attempts++;
      }
      
      throw new Error('Submit button not found after retries');
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickOkButton() {
    try {
      const okSelector = '//android.widget.Button[@resource-id="android:id/button1"]';
      
      // Retry mechanism - try up to 15 times with 300ms intervals
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        try {
          const okButton = await this.driver.$(okSelector);
          if (await okButton.isExisting()) {
            console.log('[GeneratePinPage] OK button found, clicking immediately');
            await okButton.click();
            console.log('[GeneratePinPage] PIN setup completed successfully');
            await this.driver.pause(1000); // Brief wait for navigation
            return { success: true, message: 'PIN setup completed successfully' };
          }
        } catch (e) {}
        
        await this.driver.pause(300);
        attempts++;
      }
      
      throw new Error('OK button not found after retries');
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = GeneratePinPage;