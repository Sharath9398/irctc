class TrainSearchPage {
  constructor(driver) {
    this.driver = driver;
  }

  async safeElementOperation(selector, operation, timeout = 3000, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        // Fast retry mechanism - check every 200ms
        let attempts = 0;
        const maxAttempts = timeout / 200;
        let element = null;
        
        while (attempts < maxAttempts && !element) {
          try {
            const el = await this.driver.$(selector);
            if (await el.isDisplayed()) {
              element = el;
              break;
            }
          } catch (e) {}
          
          await this.driver.pause(200);
          attempts++;
        }
        
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        
        const result = await operation(element);
        await this.driver.pause(300); // Brief pause after operation
        return { success: true, result };
      } catch (error) {
        console.log(`[DEBUG] Attempt ${i + 1}/${retries} failed for ${selector}: ${error.message}`);
        if (i === retries - 1) {
          return { success: false, error: error.message };
        }
        await this.driver.pause(500); // Brief wait before retry
        
        // Test driver responsiveness
        try {
          await this.driver.getPageSource();
        } catch (e) {
          throw new Error('Driver connection lost - UiAutomator2 may have crashed');
        }
      }
    }
  }

  async serachTrain(fromStation, toStation, dateOfJourney) {
    try {
      console.log('[trainSearchPage] Searching for trains...');

      // Enter From Station with robust error handling
      console.log('[trainSearchPage] Clicking from station field...');
      const fromResult = await this.safeElementOperation(
        '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/fromStn_code"]',
        async (element) => await element.click()
      );
      if (!fromResult.success) return { success: false, error: 'Failed to click from station field: ' + fromResult.error };

      console.log('[trainSearchPage] Entering from station:', fromStation);
      const fromInputResult = await this.safeElementOperation(
        '//android.widget.EditText[@content-desc="Enter your city/station field"]',
        async (element) => await element.setValue(fromStation)
      );
      if (!fromInputResult.success) return { success: false, error: 'Failed to enter from station: ' + fromInputResult.error };

      console.log('[trainSearchPage] Selecting first from station suggestion...');
      const fromSuggestionResult = await this.safeElementOperation(
        `//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_station_code" and @text="${fromStation}"]`,
        async (element) => await element.click()
      );
      if (!fromSuggestionResult.success) return { success: false, error: 'Failed to select from station: ' + fromSuggestionResult.error };

      // Enter To Station with robust error handling
      console.log('[trainSearchPage] Clicking to station field...');
      const toResult = await this.safeElementOperation(
        '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/toStn_code"]',
        async (element) => await element.click()
      );
      if (!toResult.success) return { success: false, error: 'Failed to click to station field: ' + toResult.error };

      console.log('[trainSearchPage] Entering to station:', toStation);
      const toInputResult = await this.safeElementOperation(
        '//android.widget.EditText[@content-desc="Enter your city/station field"]',
        async (element) => await element.setValue(toStation)
      );
      if (!toInputResult.success) return { success: false, error: 'Failed to enter to station: ' + toInputResult.error };

      console.log('[trainSearchPage] Selecting first to station suggestion...');
      const toSuggestionResult = await this.safeElementOperation(
        `//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_station_code" and @text="${toStation}"]`,
        async (element) => await element.click()
      );
      if (!toSuggestionResult.success) return { success: false, error: 'Failed to select to station: ' + toSuggestionResult.error };

      // Select date from calendar with robust error handling
      const dateResult = await this.selectDate(dateOfJourney);
      if (!dateResult.success) return dateResult;

      // Click search trains button with robust error handling
      const searchResult = await this.clickSearchTrains();
      if (!searchResult.success) return searchResult;

      console.log('[trainSearchPage] Train search completed successfully');
      return { success: true, message: 'Train search completed successfully' };
    } catch (error) {
      console.error('[trainSearchPage] Train search failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async selectDate(dateOfJourney) {
    try {
      console.log('[trainSearchPage] Selecting date:', dateOfJourney);
      
      // Click calendar button with fast retry
      const calendarResult = await this.safeElementOperation(
        '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/journey_date_label"]',
        async (element) => await element.click(),
        5000
      );
      if (!calendarResult.success) return { success: false, error: 'Failed to click calendar: ' + calendarResult.error };

      // Format and select date with fast retry
      const formattedDate = this.formatDateForCalendar(dateOfJourney);
      console.log('[trainSearchPage] Looking for date:', formattedDate);
      
      const dateResult = await this.safeElementOperation(
        `//android.view.View[@content-desc="${formattedDate}"]`,
        async (element) => await element.click(),
        3000
      );
      if (!dateResult.success) return { success: false, error: 'Failed to select date: ' + dateResult.error };

      // Click OK with fast retry
      const okResult = await this.safeElementOperation(
        '//android.widget.Button[@resource-id="android:id/button1"]',
        async (element) => await element.click()
      );
      if (!okResult.success) return { success: false, error: 'Failed to click OK: ' + okResult.error };
      
      return { success: true, message: 'Date selected successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickSearchTrains() {
    try {
      console.log('[trainSearchPage] Clicking search trains button...');
      
      const searchResult = await this.safeElementOperation(
        '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_search"]',
        async (element) => await element.click(),
        5000
      );
      if (!searchResult.success) return { success: false, error: 'Failed to click search button: ' + searchResult.error };
      
      // Wait for page transition to train list
      console.log('[trainSearchPage] Waiting for train list page to load...');
      await this.waitForTrainListLoad();
      
      console.log('[trainSearchPage] Search trains button clicked successfully');
      return { success: true, message: 'Search trains button clicked' };
    } catch (error) {
      console.error('[trainSearchPage] Failed to click search trains button:', error.message);
      return { success: false, error: error.message };
    }
  }

  async waitForTrainListLoad() {
    try {
      // Wait for train list page to load after search
      let attempts = 0;
      const maxAttempts = 100; // 20 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          // Check if loading indicators are gone
          const loadingElement = await this.driver.$('//android.widget.ProgressBar');
          if (!(await loadingElement.isExisting())) {
            // Check if train list content is present
            const trainListElements = [
              '//androidx.recyclerview.widget.RecyclerView[@resource-id="cris.org.in.prs.ima:id/lv_train_list"]',
              '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_train_name"]',
              '//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/refresh_ll"]'
            ];
            
            for (const selector of trainListElements) {
              try {
                const element = await this.driver.$(selector);
                if (await element.isExisting()) {
                  console.log('[trainSearchPage] Train list loaded successfully');
                  return { success: true, message: 'Train list loaded' };
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      console.log('[trainSearchPage] Train list load timeout - proceeding anyway');
      return { success: true, message: 'Train list load timeout - proceeding' };
    } catch (error) {
      console.log('[trainSearchPage] Train list load check failed - proceeding anyway');
      return { success: true, message: 'Train list load check failed - proceeding' };
    }
  }

  formatDateForCalendar(dateString) {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  }
}

module.exports = TrainSearchPage;