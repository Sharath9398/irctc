
class TrainSearchPage {
  constructor(driver){
    this.driver=driver;
  }

  async serachTrain(fromStation, toStation, dateOfJourney) {
    try {
      console.log('[trainSearchPage] Searching for trains...');

      // Enter From Station
      console.log('[trainSearchPage] Clicking from station field...');
      const fromStationField = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/fromStn_code"]');
      await fromStationField.waitForDisplayed({ timeout: 10000 });
      await fromStationField.click();
      await this.driver.pause(2000);
      
      console.log('[trainSearchPage] Entering from station:', fromStation);
      const fromInputField = await this.driver.$('//android.widget.EditText[@content-desc="Enter your city/station field"]');
      await fromInputField.waitForDisplayed({ timeout: 2000 });
      await fromInputField.setValue(fromStation);
      await this.driver.pause(2000);
      
      console.log('[trainSearchPage] Selecting first from station suggestion...');
      const firstFromSuggestion = await this.driver.$(`//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_station_code" and @text="${fromStation}"]
`);
      await firstFromSuggestion.waitForDisplayed({ timeout: 2000 });
      await firstFromSuggestion.click();
      await this.driver.pause(2000);

      // Enter To Station
      console.log('[trainSearchPage] Clicking to station field...');
      const toStationField = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/toStn_code"]');
      await toStationField.waitForDisplayed({ timeout: 2000 });
      await toStationField.click();
      await this.driver.pause(2000);
      
      console.log('[trainSearchPage] Entering to station:', toStation);
      const toInputField = await this.driver.$(`//android.widget.EditText[@content-desc="Enter your city/station field"]`);
      await toInputField.waitForDisplayed({ timeout: 2000 });
      await toInputField.setValue(toStation);
      await this.driver.pause(3000);
      
      console.log('[trainSearchPage] Selecting first to station suggestion...');
      const firstToSuggestion = await this.driver.$(`//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_station_code" and @text="${toStation}"]
`);
      await firstToSuggestion.waitForDisplayed({ timeout: 2000 });
      await firstToSuggestion.click();
      await this.driver.pause(2000);

      // Select date from calendar
      const dateResult = await this.selectDate(dateOfJourney);
      if (!dateResult.success) return dateResult;

      // Click search trains button
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
      
      // Click calendar button
      const calendarButton = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/journey_date_label"]');
      await calendarButton.waitForDisplayed({ timeout: 10000 });
      await calendarButton.click();
      await this.driver.pause(2000);
      
      // Format and select date
      const formattedDate = this.formatDateForCalendar(dateOfJourney);
      console.log('[trainSearchPage] Looking for date:', formattedDate);
      
      const dateElement = await this.driver.$(`//android.view.View[@content-desc="${formattedDate}"]`);
      await dateElement.waitForDisplayed({ timeout: 5000 });
      await dateElement.click();
      await this.driver.pause(1000);
      
      // Click OK
      const okButton = await this.driver.$('//android.widget.Button[@resource-id="android:id/button1"]');
      await okButton.waitForDisplayed({ timeout: 5000 });
      await okButton.click();
      await this.driver.pause(2000);
      
      return { success: true, message: 'Date selected successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clickSearchTrains() {
    try {
      console.log('[trainSearchPage] Clicking search trains button...');
      
      const searchButton = await this.driver.$('//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_search"]');
      await searchButton.waitForDisplayed({ timeout: 10000 });
      await searchButton.click();
      await this.driver.pause(3000);
      
      console.log('[trainSearchPage] Search trains button clicked successfully');
      return { success: true, message: 'Search trains button clicked' };
    } catch (error) {
      console.error('[trainSearchPage] Failed to click search trains button:', error.message);
      return { success: false, error: error.message };
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