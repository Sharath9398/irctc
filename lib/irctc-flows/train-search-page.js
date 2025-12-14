
class trainSearchPage {
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

      console.log('[trainSearchPage] Train search completed successfully');
      return { success: true, message: 'Train search completed successfully' };
    } catch (error) {
      console.error('[trainSearchPage] Train search failed:', error.message);
      return { success: false, error: error.message };
    }
  }         
}
module.exports=trainSearchPage;