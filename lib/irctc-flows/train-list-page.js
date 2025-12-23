class TrainListPage {
  constructor(driver) {
    this.driver = driver;
  }

  async selectTrainByNumber(trainNumber, trainName = null) {
    try {
      console.log(`[DEBUG] Attempting to find train: ${trainNumber}`);
      const formattedNumber = trainNumber.split('').join(' '); // e.g., "1 2 3 4 5"

      // --- STEP 0: IMMEDIATE VISIBILITY CHECK (Zero Delay) ---
      // Prevents "waiting to start scroll" if train is already on screen (positions 1-4)
      try {
        const directEl = await this.driver.$(`//android.widget.TextView[@content-desc="${formattedNumber}"]`);
        // Use a very short wait (implicit wait might override, but we check existence first)
        if (await directEl.isExisting() && await directEl.isDisplayed()) {
          console.log(`[DEBUG] Train found immediately (no scroll needed): ${formattedNumber}`);
          await this.clickRefreshByPosition(0, directEl);
          return { success: true, message: `Train found immediately` };
        }
      } catch (e) { /* Ignore and proceed to scroll */ }

      // --- STRATEGY 1: Native Android Scroll (UiScrollable) ---
      // This runs on the device side, much faster/smoother than sending actions
      try {
        console.log('[DEBUG] Trying fast native scroll...');
        const scrollSelector = `new UiScrollable(new UiSelector().resourceId("cris.org.in.prs.ima:id/lv_train_list").scrollable(true)).setAsVerticalList().scrollIntoView(new UiSelector().descriptionContains("${formattedNumber}"));`;
        const trainElement = await this.driver.$(`android=${scrollSelector}`);

        // If found, we need to ensure the Refresh button is also visible. 
        // scrollIntoView puts the item in view, but the refresh button might be just below it.
        if (await trainElement.isExisting()) {
          console.log(`[DEBUG] Found train via Native Scroll: ${formattedNumber}`);

          // Verify it's actually displayed (sometimes UiScrollable returns true but item is barely visible)
          if (await trainElement.isDisplayed()) {
            await this.clickRefreshByPosition(0, trainElement);
            return { success: true, message: `Train found via native scroll` };
          }
        }
      } catch (e) {
        console.log(`[DEBUG] Native scroll failed or timed out: ${e.message}. Falling back to manual scroll.`);
      }

      // --- STRATEGY 2: Optimized Manual Fling (Fallback) ---
      console.log(`[DEBUG] Falling back to manual fling search...`);

      let scrollCount = 0;
      const MAX_SCROLLS = 15; // Covers ~60-80 trains with deep flings

      while (scrollCount < MAX_SCROLLS) {
        // Check availability
        try {
          const trainElement = await this.driver.$(`//android.widget.TextView[@content-desc="${formattedNumber}"]`);
          if (await trainElement.isDisplayed()) {
            console.log(`[DEBUG] Found train manually: ${formattedNumber}`);
            await this.clickRefreshByPosition(0, trainElement);
            return { success: true, message: `Train found manually` };
          }
        } catch (e) { }

        // Scroll logic
        await this.performFastScroll();
        await this.driver.pause(500); // Wait for momentum to settle
        scrollCount++;
      }

      return { success: false, error: `Train ${trainNumber} not found in list` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async performFastScroll() {
    const { width, height } = await this.driver.getWindowSize();
    // Use a larger scroll area (80% -> 20%) and faster duration (150ms) to trigger a "fling"
    // This allows the list to coast with momentum, showing more items per action.
    const startY = Math.floor(height * 0.80);
    const endY = Math.floor(height * 0.20);
    const centerX = Math.floor(width / 2);

    console.log(`[DEBUG] Flinging list...`);

    await this.driver.performActions([{
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: centerX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 150, x: centerX, y: endY }, // Fast value = Fling
        { type: 'pointerUp', button: 0 }
      ]
    }]);
  }

  async getTrainPositionOnScreen(formattedTrainNumber) {
    const visibleTrains = await this.driver.$$('//android.widget.TextView[contains(@content-desc, " ")]');
    for (let j = 0; j < visibleTrains.length; j++) {
      const trainDesc = await visibleTrains[j].getAttribute('content-desc');
      if (trainDesc === formattedTrainNumber) {
        console.log(`[DEBUG] Train found at screen position: ${j}`);
        return j;
      }
    }
    return 0;
  }

  async getTrainPositionByNameOnScreen(trainName) {
    const visibleTrains = await this.driver.$$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_train_name"]');
    for (let j = 0; j < visibleTrains.length; j++) {
      const trainText = await visibleTrains[j].getText();
      if (trainText.includes(trainName)) {
        console.log(`[DEBUG] Train found by name at screen position: ${j}`);
        return j;
      }
    }
    return 0;
  }

  async clickRefreshByPosition(windowIndex, trainElement) {
    try {
      const trainNumber = await trainElement.getAttribute('content-desc');
      console.log(`[DEBUG] Attempting geometric distance calculation to anchor refresh button.`);

      const trainLocation = await trainElement.getLocation();
      const trainCenterY = trainLocation.y;

      // 1. Find ALL refresh buttons visible on the screen.
      const allRefreshButtons = await this.driver.$$(`//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/refresh_ll"]`);

      if (allRefreshButtons.length === 0) {
        return { success: false, error: 'No refresh buttons found on screen.' };
      }

      let closestButton = null;
      let minDistance = Infinity;

      // 2. Iterate through all found refresh buttons and find the one closest to the train's Y-coordinate.
      for (const button of allRefreshButtons) {
        if (await button.isDisplayed()) {
          const buttonLocation = await button.getLocation();

          // We look for the button that is below the train number (buttonLocation.y > trainCenterY)
          // AND has the smallest vertical distance.
          const verticalDistance = Math.abs(buttonLocation.y - trainCenterY);

          if (buttonLocation.y > trainCenterY && verticalDistance < minDistance) {
            minDistance = verticalDistance;
            closestButton = button;
          }
        }
      }

      if (closestButton) {
        await closestButton.click();
        console.log(`[DEBUG] Clicked refresh button successfully for train ${trainNumber} via geometric distance.`);
        return { success: true, message: 'Refresh clicked for correct train' };
      }

      return { success: false, error: 'Could not find a geometrically close refresh button below the train.' };

    } catch (error) {
      console.log(`[DEBUG] Refresh click failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async clickRefresh(trainNumber) {
    try {
      console.log(`[DEBUG] Clicking refresh for train: ${trainNumber}`);

      // Fast retry mechanism for refresh button
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds at 200ms intervals
      let refreshButton = null;

      while (attempts < maxAttempts && !refreshButton) {
        try {
          const button = await this.driver.$('//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/refresh_ll"]');
          if (await button.isDisplayed()) {
            refreshButton = button;
            console.log(`[DEBUG] Refresh button found, clicking immediately`);
            break;
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      if (!refreshButton) {
        throw new Error('Refresh button not found after retries');
      }

      await refreshButton.click();
      await this.driver.pause(500); // Brief wait for response

      console.log(`[DEBUG] Refresh button clicked successfully for train ${trainNumber}`);
      return { success: true, message: `Refresh clicked for train ${trainNumber}` };
    } catch (error) {
      console.error(`[DEBUG] Failed to click refresh: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async selectTrainClass(trainClass) {
    try {
      console.log(`[DEBUG] Selecting train class: ${trainClass}`);

      // Fast retry for availability page selector first
      let attempts = 0;
      const maxAttempts = 15; // 3 seconds at 200ms intervals

      while (attempts < maxAttempts) {
        try {
          const classElement = await this.driver.$(`//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_avl_class" and @text="${trainClass}"]`);
          if (await classElement.isDisplayed()) {
            await classElement.click();
            console.log(`[DEBUG] Clicked on availability class: ${trainClass} immediately`);
            await this.driver.pause(1000); // Brief wait for response
            return { success: true, message: `Train class ${trainClass} selected from availability` };
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      // Fast retry for fallback selector
      attempts = 0;
      const maxFallbackAttempts = 25; // 5 seconds at 200ms intervals

      while (attempts < maxFallbackAttempts) {
        try {
          const classElement = await this.driver.$(`//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_class" and @text="${trainClass}"]`);
          if (await classElement.isDisplayed()) {
            await classElement.click();
            console.log(`[DEBUG] Clicked on class: ${trainClass} immediately`);
            await this.driver.pause(1000); // Brief wait for response
            return { success: true, message: `Train class ${trainClass} selected and availability opened` };
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      throw new Error(`Train class ${trainClass} not found after retries`);
    } catch (error) {
      console.error(`[DEBUG] Failed to select train class: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async clickContinue() {
    try {
      console.log(`[DEBUG] Clicking continue to passenger details`);

      // Fast retry mechanism - check every 200ms for up to 10 seconds
      let attempts = 0;
      const maxAttempts = 50; // 10 seconds at 200ms intervals

      while (attempts < maxAttempts) {
        try {
          const continueButton = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_continue"]');
          if (await continueButton.isDisplayed()) {
            await continueButton.click();
            console.log(`[DEBUG] Continue button clicked immediately after ${attempts * 200}ms`);
            await this.driver.pause(500); // Brief wait for navigation
            return { success: true, message: 'Continue to passenger details clicked' };
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      return { success: false, error: 'Continue button not found after 10 seconds' };
    } catch (error) {
      console.error(`[DEBUG] Failed to click continue: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async handleWarningAlert() {
    try {
      console.log(`[DEBUG] Checking for warning alert`);

      // Fast retry mechanism - check every 200ms for up to 3 seconds
      let attempts = 0;
      const maxAttempts = 15; // 3 seconds at 200ms intervals

      while (attempts < maxAttempts) {
        try {
          const alertTitle = await this.driver.$('//android.widget.TextView[@resource-id="android:id/alertTitle"]');
          if (await alertTitle.isDisplayed()) {
            console.log(`[DEBUG] Warning alert detected, clicking OK immediately`);

            const okButton = await this.driver.$('//android.widget.Button[@resource-id="android:id/button1"]');
            await okButton.click();

            console.log(`[DEBUG] Alert OK button clicked successfully`);
            await this.driver.pause(500); // Brief wait for alert dismissal
            return { success: true, message: 'Warning alert handled' };
          }
        } catch (e) { }

        await this.driver.pause(200);
        attempts++;
      }

      console.log(`[DEBUG] No warning alert found, proceeding`);
      return { success: true, message: 'No warning alert to handle' };
    } catch (error) {
      console.error(`[DEBUG] Failed to handle warning alert: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TrainListPage;