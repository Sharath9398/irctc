class TrainListPage {
  constructor(driver) {
    this.driver = driver;
  }

  async selectTrainByNumber(trainNumber, trainName = null) {
    try {
      console.log(`[DEBUG] Attempting direct find for train: ${trainNumber}, name: ${trainName}`);
      
      const TRAIN_LIST_PARENT = '//androidx.recyclerview.widget.RecyclerView[@resource-id="cris.org.in.prs.ima:id/lv_train_list"]';
      const formattedNumber = trainNumber.split('').join(' ');

      // --- 1. ATTEMPT DIRECT FIND (Fastest check for rendered trains) ---
      const trainNumberXPath = `${TRAIN_LIST_PARENT}//android.widget.TextView[@content-desc="${formattedNumber}"]`;
      try {
          const trainElement = await this.driver.$(trainNumberXPath);
          if (await trainElement.isDisplayed()) {
              console.log(`[DEBUG] Found train directly by number: ${formattedNumber}`);
              await this.clickRefreshByPosition(0, trainElement);
              return { success: true, message: `Train ${trainNumber} found directly by number` };
          }
      } catch (e) { /* Direct find failed, continue to fallback */ }
      
      if (trainName) {
          const trainNameXPath = `${TRAIN_LIST_PARENT}//*[contains(@text, "${trainName}")]`;
          try {
              const nameElement = await this.driver.$(trainNameXPath);
              if (await nameElement.isDisplayed()) {
                  console.log(`[DEBUG] Found train directly by name: ${trainName}`);
                  await this.clickRefreshByPosition(0, nameElement);
                  return { success: true, message: `Train ${trainName} found directly by name` };
              }
          } catch (e) { /* Direct find failed, continue to fallback */ }
      }

      // --- 2. FALLBACK TO SCROLLING SEARCH (For non-rendered trains) ---
      console.log(`[DEBUG] Train not immediately rendered. Falling back to scrolling search...`);

      let scrollCount = 0;
      // Scroll limit set to 30 (to search up to 90 trains)
      while (scrollCount < 30) { 
        
        // Check by train number (spaced format)
        try {
          const trainElement = await this.driver.$(`//android.widget.TextView[@content-desc="${formattedNumber}"]`); 
          if (await trainElement.isDisplayed()) {
            console.log(`[DEBUG] Found train by number during scroll: ${formattedNumber}`);
            await this.clickRefreshByPosition(0, trainElement);
            return { success: true, message: `Train ${trainNumber} found by number` };
          }
        } catch (e) {}
        
        // Check by train name (if provided)
        if (trainName) {
          try {
            const nameElement = await this.driver.$(`//*[contains(@text, "${trainName}")]`);
            if (await nameElement.isDisplayed()) {
              console.log(`[DEBUG] Found train by name during scroll: ${trainName}`);
              await this.clickRefreshByPosition(0, nameElement);
              return { success: true, message: `Train ${trainName} found by name` };
            }
          } catch (e) {}
        }
        
        // SCROLL
        await this.scrollToNext3Trains(); 
        await this.driver.pause(400);
        scrollCount++;
      }
      
      return { success: false, error: `Train ${trainNumber} not found in entire list` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

 async scrollToNext3Trains() {
    const { width, height } = await this.driver.getWindowSize();
    
    // ADJUSTMENT: Changing from 50% to 40% scroll distance for consistency.
    // Start the swipe from 65% down
    const startY = Math.floor(height * 0.60);
    
    // End the swipe at 25% down (0.65 - 0.25 = 0.40)
    const endY = Math.floor(height * 0.20); 
    
    const centerX = Math.floor(width / 2);
    
    console.log(`[DEBUG] Scrolling from Y=${startY} to Y=${endY} (40% scroll distance)`);

    await this.driver.performActions([{
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: centerX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 700, x: centerX, y: endY }, 
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
      
      const refreshButton = await this.driver.$('//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/refresh_ll"]');
      await refreshButton.waitForDisplayed({ timeout: 10000 });
      await refreshButton.click();
      await this.driver.pause(2000);
      
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
      
      // Try the availability page selector first (after refresh)
      try {
        const classElement = await this.driver.$(`//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_avl_class" and @text="${trainClass}"]`);
        await classElement.waitForDisplayed({ timeout: 3000 });
        await classElement.click();
        console.log(`[DEBUG] Clicked on availability class: ${trainClass}`);
        await this.driver.pause(3000);
        return { success: true, message: `Train class ${trainClass} selected from availability` };
      } catch (e) {}
      
      // Fallback to original selector
      const classElement = await this.driver.$(`//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_class" and @text="${trainClass}"]`);
      await classElement.waitForDisplayed({ timeout: 5000 });
      await classElement.click();
      
      console.log(`[DEBUG] Clicked on class: ${trainClass}`);
      await this.driver.pause(3000);
      
      return { success: true, message: `Train class ${trainClass} selected and availability opened` };
    } catch (error) {
      console.error(`[DEBUG] Failed to select train class: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TrainListPage;