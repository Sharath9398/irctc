class PassengerDetailsPage {
  constructor(driver) {
    this.driver = driver;
  }

  async clickAddNewPassenger() {
    try {
      console.log(`[DEBUG] Clicking add new passenger`);
      
      // Fast retry mechanism - check every 200ms for up to 10 seconds
      let attempts = 0;
      const maxAttempts = 50; // 10 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          const addButton = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_add_psgn_detail"]');
          if (await addButton.isDisplayed()) {
            await addButton.click();
            console.log(`[DEBUG] Add new passenger button clicked immediately after ${attempts * 200}ms`);
            await this.driver.pause(500); // Brief wait for form to appear
            return { success: true, message: 'Add new passenger clicked' };
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      return { success: false, error: 'Add new passenger button not found after 10 seconds' };
    } catch (error) {
      console.error(`[DEBUG] Failed to click add new passenger: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async fillPassengerDetails(passenger) {
    try {
      console.log(`[DEBUG] Filling passenger details for:`, passenger);
      
      // Fill name with fast retry logic
      const nameSelector = '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/passenger_name"]';
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds at 200ms intervals
      let nameField = null;
      
      while (attempts < maxAttempts && !nameField) {
        try {
          const field = await this.driver.$(nameSelector);
          if (await field.isDisplayed()) {
            nameField = field;
            console.log(`[DEBUG] Name field found, typing immediately`);
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      if (!nameField) {
        throw new Error('Name field not found after retries');
      }
      
      await nameField.setValue(passenger.name || '');
      console.log(`[DEBUG] Name field filled successfully`);
      
      // Fill age with fast retry
      attempts = 0;
      let ageField = null;
      
      while (attempts < 15 && !ageField) { // 3 seconds at 200ms intervals
        try {
          const field = await this.driver.$('//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/passenger_age"]');
          if (await field.isDisplayed()) {
            ageField = field;
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      if (ageField) {
        await ageField.setValue((passenger.age || '').toString());
        console.log(`[DEBUG] Age field filled successfully`);
      }
      
      // Select gender
      if (passenger.gender) {
        const genderResult = await this.selectGender(passenger.gender);
        if (!genderResult.success) return genderResult;
      }
      
      // Select berth choice
      if (passenger.berth) {
        const berthResult = await this.selectBerthChoice(passenger.berth);
        if (!berthResult.success) console.log('[DEBUG] Berth selection failed, continuing...');
      }
      
      // Select food choice
      if (passenger.food) {
        const foodResult = await this.selectFoodChoice(passenger.food);
        if (!foodResult.success) console.log('[DEBUG] Food selection failed, continuing...');
      }
      
      // Click add passenger (Done button) with fast retry
      attempts = 0;
      let addButton = null;
      
      while (attempts < 15 && !addButton) { // 3 seconds at 200ms intervals
        try {
          const button = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_done_psgn_detail"]');
          if (await button.isDisplayed()) {
            addButton = button;
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      if (addButton) {
        await addButton.click();
        console.log(`[DEBUG] Passenger ${passenger.name} added successfully`);
        await this.driver.pause(500); // Brief wait for form to close
      }
      
      return { success: true, message: `Passenger ${passenger.name} added` };
    } catch (error) {
      console.error(`[DEBUG] Failed to fill passenger details: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async selectGender(gender) {
    try {
      let genderSelector;
      
      // Database saves M/F, so handle both formats
      switch (gender.toUpperCase()) {
        case 'MALE':
        case 'M':
          genderSelector = '//android.widget.RadioButton[@resource-id="cris.org.in.prs.ima:id/tv_male"]';
          break;
        case 'FEMALE':
        case 'F':
          genderSelector = '//android.widget.RadioButton[@resource-id="cris.org.in.prs.ima:id/tv_female"]';
          break;
        case 'TRANSGENDER':
        case 'T':
          genderSelector = '//android.widget.RadioButton[@resource-id="cris.org.in.prs.ima:id/tv_transgender"]';
          break;
        default:
          genderSelector = '//android.widget.RadioButton[@resource-id="cris.org.in.prs.ima:id/tv_male"]'; // Default to male
      }
      
      const genderButton = await this.driver.$(genderSelector);
      await genderButton.click();
      
      return { success: true, message: `Gender ${gender} selected` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async selectBerthChoice(berthChoice) {
    try {
      // Add berth selection logic here when you provide the selectors
      console.log(`[DEBUG] Selecting berth choice: ${berthChoice}`);
      return { success: true, message: `Berth ${berthChoice} selected` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async selectFoodChoice(foodChoice) {
    try {
      // Add food selection logic here when you provide the selectors
      console.log(`[DEBUG] Selecting food choice: ${foodChoice}`);
      return { success: true, message: `Food ${foodChoice} selected` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addAllPassengers(passengers) {
    try {
      console.log(`[DEBUG] Adding ${passengers.length} passengers`);
      
      for (let i = 0; i < passengers.length; i++) {
        const passenger = passengers[i];
        
        // Click add new passenger for each passenger (including first one)
        const addResult = await this.clickAddNewPassenger();
        if (!addResult.success) return addResult;
        
        // Fill passenger details
        const fillResult = await this.fillPassengerDetails(passenger);
        if (!fillResult.success) return fillResult;
      }
      
      return { success: true, message: `All ${passengers.length} passengers added successfully` };
    } catch (error) {
      console.error(`[DEBUG] Failed to add all passengers: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async scrollToBottomAndHandleOptions(ticketData) {
    try {
      console.log('[DEBUG] Scrolling to bottom and handling options');
      
      // Faster scroll down to reach bottom
      for (let i = 0; i < 8; i++) {
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
              args: ['swipe', '540', '1500', '540', '500', '500'] // Reduced duration from 1000ms to 500ms
            });
          } catch (e2) {
            console.log('[DEBUG] Scroll failed, continuing without scroll');
          }
        }
        await this.driver.pause(50); // Reduced from 100ms to 50ms
      }
      
      // Handle auto-upgrade checkbox with fast retry
      if (ticketData.consider_auto_upgrade) {
        let attempts = 0;
        const maxAttempts = 10; // 2 seconds at 200ms intervals
        
        while (attempts < maxAttempts) {
          try {
            const autoUpgradeCheckbox = await this.driver.$('//android.widget.CheckBox[@resource-id="cris.org.in.prs.ima:id/auto_upgradation"]');
            if (await autoUpgradeCheckbox.isDisplayed()) {
              await autoUpgradeCheckbox.click();
              console.log('[DEBUG] Auto-upgrade checkbox checked immediately');
              break;
            }
          } catch (e) {}
          
          await this.driver.pause(200);
          attempts++;
        }
      }
      
      // Handle payment method selection
      const paymentResult = await this.selectPaymentMethod(ticketData);
      if (!paymentResult.success) return paymentResult;
      
      // Click review journey details with fast retry
      let attempts = 0;
      const maxAttempts = 15; // 3 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          const reviewButton = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/journey_detail"]');
          if (await reviewButton.isDisplayed()) {
            await reviewButton.click();
            console.log('[DEBUG] Review journey details clicked immediately');
            
            // Wait for page transition to complete
            console.log('[DEBUG] Waiting for next page to load after review journey click...');
            await this.waitForPageTransition();
            break;
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      return { success: true, message: 'Options handled successfully' };
    } catch (error) {
      console.error(`[DEBUG] Failed to handle options: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async selectPaymentMethod(ticketData) {
    try {
      console.log(`[DEBUG] Selecting payment method based on ticket data:`, ticketData);
      let paymentSelector;
      
      if (ticketData.payment_type === 'bank') {
        paymentSelector = '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_payment_option" and @text="Pay through BHIM/UPI"]';
        console.log('[DEBUG] Using BHIM/UPI payment selector for bank payment type');
      } else if (ticketData.payment_type === 'debit' || ticketData.payment_type === 'credit') {
        paymentSelector = '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_payment_option" and @text="Pay through Credit & Debit Cards / Net Banking / Wallets / EMI / UPI_CC / UPI_CL / Rewards and Others"]';
        console.log('[DEBUG] Using Credit/Debit/NetBanking payment selector for card payment type');
      } else {
        paymentSelector = '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_payment_option" and @text="Pay through Credit & Debit Cards / Net Banking / Wallets / EMI / UPI_CC / UPI_CL / Rewards and Others"]';
        console.log('[DEBUG] Using default Credit/Debit/NetBanking payment selector');
      }
      
      // Fast retry mechanism for payment method selection
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          const paymentButton = await this.driver.$(paymentSelector);
          if (await paymentButton.isDisplayed()) {
            await paymentButton.click();
            console.log(`[DEBUG] Payment method selected immediately after ${attempts * 200}ms`);
            return { success: true, message: 'Payment method selected' };
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      return { success: false, error: 'Payment method not found after 5 seconds' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async waitForPageTransition() {
    try {
      // Wait for page transition to complete after clicking review journey
      let attempts = 0;
      const maxAttempts = 100; // 20 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        try {
          // Check if we're no longer on passenger details page
          const passengerPageElements = [
            '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_add_psgn_detail"]',
            '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/journey_detail"]'
          ];
          
          let stillOnPassengerPage = false;
          for (const selector of passengerPageElements) {
            try {
              const element = await this.driver.$(selector);
              if (await element.isExisting()) {
                stillOnPassengerPage = true;
                break;
              }
            } catch (e) {}
          }
          
          // If we're no longer on passenger page, check if new page has loaded
          if (!stillOnPassengerPage) {
            const newPageElements = [
              '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
              '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/captcha_input"]',
              '//*[contains(@text, "Review")]',
              '//*[contains(@text, "Journey")]'
            ];
            
            for (const selector of newPageElements) {
              try {
                const element = await this.driver.$(selector);
                if (await element.isExisting()) {
                  console.log('[DEBUG] Page transition completed - new page loaded');
                  return { success: true, message: 'Page transition completed' };
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
        
        await this.driver.pause(200);
        attempts++;
      }
      
      console.log('[DEBUG] Page transition timeout - proceeding anyway');
      return { success: true, message: 'Page transition timeout - proceeding' };
    } catch (error) {
      console.log('[DEBUG] Page transition check failed - proceeding anyway');
      return { success: true, message: 'Page transition check failed - proceeding' };
    }
  }
}

module.exports = PassengerDetailsPage;