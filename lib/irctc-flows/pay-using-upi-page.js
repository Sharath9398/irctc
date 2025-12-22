// lib/irctc-flows/pay-using-upi-page.js

class PayUsingUpiPage {
  constructor(driver) {
    this.driver = driver;
  }

  async scrollDown() {
    try {
      // Use mobile: swipeGesture which is supported
      await this.driver.execute('mobile: swipeGesture', {
        left: 100, top: 1500, width: 200, height: 200,
        direction: 'up',
        percent: 0.8
      });
      await this.driver.pause(300); // Reduced from 1000ms to 300ms
    } catch (e) {
      try {
        // Fallback to shell command
        await this.driver.execute('mobile: shell', {
          command: 'input',
          args: ['swipe', '540', '1500', '540', '500', '500'] // Reduced duration from 1000ms to 500ms
        });
        await this.driver.pause(300); // Reduced from 1000ms to 300ms
      } catch (e2) {
        // Final fallback to key presses
        for (let i = 0; i < 5; i++) {
          await this.driver.pressKeyCode(20);
          await this.driver.pause(100); // Reduced from 200ms to 100ms
        }
      }
    }
  }

  async selectProviderAndPay(paymentGateway, upiId, ticketData) {
    try {
      const selectors = [
        `//android.widget.TextView[@content-desc="msg_first_line_one" and translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')="${paymentGateway.toLowerCase()}"]`,
        `//android.widget.TextView[translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')="${paymentGateway.toLowerCase()}"]`,
        `//android.widget.TextView[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${paymentGateway.toLowerCase()}")]`,
        `//android.widget.TextView[@text="${paymentGateway}"]`,
        `//android.widget.TextView[@text="${paymentGateway.toUpperCase()}"]`,
        `//android.widget.TextView[@text="${paymentGateway.toLowerCase()}"]`,
        `//android.widget.TextView[@text="${paymentGateway.charAt(0).toUpperCase() + paymentGateway.slice(1).toLowerCase()}"]`,
        `//android.widget.TextView[contains(@text, "${paymentGateway}")]`,
        `//*[contains(@text, "${paymentGateway}")]`
      ];
      
      let providerButton;
      let isProviderFound = false;

      for (let i = 0; i < 8; i++) {
        for (const selector of selectors) {
          try {
            providerButton = await this.driver.$(selector);
            if (await providerButton.isDisplayed()) {
              isProviderFound = true;
              break;
            }
          } catch (e) {}
        }
        
        if (isProviderFound) break;
        await this.scrollDown();
      }

      if (!isProviderFound) {
        return { success: false, error: `Payment provider "${paymentGateway}" not found` };
      }

      await providerButton.click();
      await this.driver.pause(1000); // Reduced from 2000ms to 1000ms
      
      // Click PROCEED TO PAY with fast retry
      const proceedSelectors = [
        '//android.widget.TextView[starts-with(@text, "PROCEED TO PAY")]',
        '//android.widget.TextView[contains(@text, "PROCEED")]',
        '//*[contains(@text, "PROCEED TO PAY")]'
      ];
      
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds at 200ms intervals
      let proceedFound = false;
      
      while (attempts < maxAttempts && !proceedFound) {
        for (const selector of proceedSelectors) {
          try {
            const proceedButton = await this.driver.$(selector);
            if (await proceedButton.isDisplayed()) {
              await proceedButton.click();
              console.log('[PayUsingUpiPage] PROCEED TO PAY clicked immediately');
              proceedFound = true;
              break;
            }
          } catch (e) {}
        }
        
        if (!proceedFound) {
          await this.driver.pause(200);
          attempts++;
        }
      }
      
      if (!proceedFound) {
        return { success: false, error: 'PROCEED TO PAY button not found after 5 seconds' };
      }
      
      await this.driver.pause(1000); // Reduced from 3000ms to 1000ms
      
      // Enter UPI ID
      if (!upiId || !upiId.trim()) {
        return { success: false, error: 'UPI ID is required' };
      }
      
      const upiResult = await this.enterUpiIdAndPay(upiId);
      if (!upiResult.success) return upiResult;
      
      return { success: true, message: 'UPI payment completed' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async enterUpiIdAndPay(upiId) {
    try {
      // Click UPI field with fast retry
      const upiFieldSelectors = [
        '//android.widget.TextView[@content-desc="msg_first_line_one"]',
        '//android.widget.EditText[@content-desc="edt_vpa"]',
        '//*[@content-desc="msg_first_line_one"]'
      ];
      
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds at 200ms intervals
      let upiFieldFound = false;
      
      while (attempts < maxAttempts && !upiFieldFound) {
        for (const selector of upiFieldSelectors) {
          try {
            const upiField = await this.driver.$(selector);
            if (await upiField.isDisplayed()) {
              await upiField.click();
              console.log('[PayUsingUpiPage] UPI field clicked immediately');
              await this.driver.pause(500); // Reduced from 1000ms to 500ms
              upiFieldFound = true;
              break;
            }
          } catch (e) {}
        }
        
        if (!upiFieldFound) {
          await this.driver.pause(200);
          attempts++;
        }
      }
      
      if (!upiFieldFound) {
        throw new Error('UPI field not found after 5 seconds');
      }
      
      // Enter UPI ID with fast retry
      const upiInputSelectors = [
        '//android.widget.EditText[@content-desc="edt_vpa"]',
        '//android.widget.EditText[contains(@hint, "UPI")]',
        '//android.widget.EditText[1]'
      ];
      
      attempts = 0;
      let upiInputFound = false;
      
      while (attempts < maxAttempts && !upiInputFound) {
        for (const selector of upiInputSelectors) {
          try {
            const upiInput = await this.driver.$(selector);
            if (await upiInput.isDisplayed()) {
              await upiInput.clearValue();
              await this.driver.pause(200); // Reduced from 500ms to 200ms
              await upiInput.setValue(upiId);
              console.log('[PayUsingUpiPage] UPI ID entered immediately');
              await this.driver.pause(500); // Reduced from 1000ms to 500ms
              upiInputFound = true;
              break;
            }
          } catch (e) {}
        }
        
        if (!upiInputFound) {
          await this.driver.pause(200);
          attempts++;
        }
      }
      
      if (!upiInputFound) {
        throw new Error('UPI input field not found after 5 seconds');
      }
      
      // Click Verify and Pay with fast retry
      const verifyPaySelectors = [
        '//android.widget.TextView[@content-desc="msg_text" and contains(@text, "Verify and Pay")]',
        '//android.widget.TextView[contains(@text, "Verify and Pay")]',
        '//*[contains(@text, "Verify and Pay")]'
      ];
      
      attempts = 0;
      let verifyPayFound = false;
      
      while (attempts < maxAttempts && !verifyPayFound) {
        for (const selector of verifyPaySelectors) {
          try {
            const verifyPayButton = await this.driver.$(selector);
            if (await verifyPayButton.isDisplayed()) {
              await verifyPayButton.click();
              console.log('[PayUsingUpiPage] Verify and Pay clicked immediately');
              await this.driver.pause(1000); // Reduced from 2000ms to 1000ms
              verifyPayFound = true;
              break;
            }
          } catch (e) {}
        }
        
        if (!verifyPayFound) {
          await this.driver.pause(200);
          attempts++;
        }
      }
      
      if (!verifyPayFound) {
        return { success: false, error: 'Verify and Pay button not found after 5 seconds' };
      }
      
      return { success: true, message: `UPI ID ${upiId} entered and payment initiated` };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = PayUsingUpiPage;