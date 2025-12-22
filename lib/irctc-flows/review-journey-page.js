const CaptchaSolver = require('../captcha-solver');

class ReviewJourneyPage {
  constructor(driver) {
    this.driver = driver;
    this.captchaSolver = new CaptchaSolver(driver);
  }

  async solveCaptchaAndProceed() {
    try {
      console.log('[DEBUG] Looking for captcha on review journey page');
      
      // Wait for page to fully load after navigation
      console.log('[DEBUG] Waiting for review journey page to load completely...');
      await this.waitForPageLoad();
      
      // Faster scroll down using swipeGesture
      for (let i = 0; i < 6; i++) {
        try {
          await this.driver.execute('mobile: swipeGesture', {
            left: 100, top: 1500, width: 200, height: 200,
            direction: 'up',
            percent: 0.8
          });
        } catch (e) {
          try {
            await this.driver.execute('mobile: shell', {
              command: 'input',
              args: ['swipe', '540', '1500', '540', '500', '500']
            });
          } catch (e2) {
            console.log('[DEBUG] Scroll failed, continuing without scroll');
          }
        }
        await this.driver.pause(50);
      }
      
      // Find captcha image with extended retry for slow loading
      let attempts = 0;
      const maxAttempts = 150; // 30 seconds at 200ms intervals for slow networks
      let captchaFound = false;
      
      while (attempts < maxAttempts && !captchaFound) {
        try {
          const captchaElement = await this.driver.$('//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]');
          if (await captchaElement.isDisplayed()) {
            console.log(`[DEBUG] Captcha found after ${attempts * 200}ms`);
            captchaFound = true;
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      if (!captchaFound) {
        throw new Error('Captcha not found after 30 seconds - page may not have loaded');
      }

      // Solve captcha using OCR
      const result = await this.captchaSolver.solveCaptcha('//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]');
      
      if (!result.success) {
        return { success: false, error: 'Failed to solve captcha' };
      }

      console.log(`[DEBUG] Captcha solved: ${result.text}`);

      // Enter captcha text with fast retry
      attempts = 0;
      const maxInputAttempts = 15;
      let captchaInput = null;
      
      while (attempts < maxInputAttempts && !captchaInput) {
        try {
          const input = await this.driver.$('//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/captcha_input"]');
          if (await input.isDisplayed()) {
            captchaInput = input;
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      if (captchaInput) {
        await captchaInput.setValue(result.text);
        console.log('[DEBUG] Captcha text entered immediately');
      }

      // Click proceed to pay with fast retry
      attempts = 0;
      const maxProceedAttempts = 15;
      
      while (attempts < maxProceedAttempts) {
        try {
          const proceedButton = await this.driver.$('//android.widget.TextView[@content-desc="Proceed to Pay"]');
          if (await proceedButton.isDisplayed()) {
            await proceedButton.click();
            console.log('[DEBUG] Proceed to Pay clicked immediately');
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }

      // Handle optional warning modal
      await this.handleOptionalWarning();

      return { success: true, message: 'Captcha solved and proceeded to payment' };
    } catch (error) {
      console.error(`[DEBUG] Failed to solve captcha and proceed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async handleOptionalWarning() {
    try {
      console.log('[DEBUG] Checking for optional warning modal');
      const selector = '//android.widget.Button[@resource-id="android:id/button1"]';
      
      // Fast retry for warning modal - check every 200ms for up to 3 seconds
      let attempts = 0;
      const maxAttempts = 15; // 3 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          const warningButton = await this.driver.$(selector);
          if (await warningButton.isDisplayed()) {
            console.log('[DEBUG] Optional warning modal found. Clicking OK immediately.');
            await warningButton.click();
            return { success: true, message: 'Clicked OK on optional warning.' };
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      console.log('[DEBUG] No optional warning modal found. Continuing.');
      return { success: true, message: 'No optional warning modal found.' };
    } catch (error) {
      console.error(`[DEBUG] Error handling optional warning: ${error.message}`);
      return { success: true, message: 'Continuing after error in optional warning handler.' };
    }
  }

  async waitForPageLoad() {
    try {
      // Wait for page loading indicators to disappear and content to appear
      let attempts = 0;
      const maxAttempts = 100; // 20 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          // Check if loading indicators are gone
          const loadingIndicators = [
            '//android.widget.ProgressBar',
            '//*[contains(@text, "Loading")]',
            '//*[contains(@text, "Please wait")]'
          ];
          
          let isLoading = false;
          for (const selector of loadingIndicators) {
            try {
              const loadingElement = await this.driver.$(selector);
              if (await loadingElement.isExisting()) {
                isLoading = true;
                break;
              }
            } catch (e) {}
          }
          
          // If no loading indicators, check if page content is present
          if (!isLoading) {
            const pageContentSelectors = [
              '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
              '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/captcha_input"]',
              '//android.widget.TextView[@content-desc="Proceed to Pay"]',
              '//*[contains(@text, "Review")]'
            ];
            
            for (const selector of pageContentSelectors) {
              try {
                const contentElement = await this.driver.$(selector);
                if (await contentElement.isExisting()) {
                  console.log('[DEBUG] Page loaded - content found');
                  return { success: true, message: 'Page loaded successfully' };
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      console.log('[DEBUG] Page load timeout - proceeding anyway');
      return { success: true, message: 'Page load timeout - proceeding' };
    } catch (error) {
      console.log('[DEBUG] Page load check failed - proceeding anyway');
      return { success: true, message: 'Page load check failed - proceeding' };
    }
  }
}

module.exports = ReviewJourneyPage;