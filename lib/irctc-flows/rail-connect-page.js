// lib/irctc-flows/rail-connect-page.js

class RailConnectPage {
  constructor(driver) {
    this.driver = driver;
  }

  async clickTrainButton() {
    try {
      const trainButtonSelectors = [
        '//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/my_journey_ll"]/android.widget.ImageView',
        '//android.widget.ImageView[contains(@content-desc, "Train")]',
        '//android.widget.TextView[contains(@text, "Train")]',
        '//android.widget.LinearLayout[contains(@resource-id, "journey")]//android.widget.ImageView'
      ];
      
      // Fast retry mechanism - check every 200ms for up to 6 seconds
      let attempts = 0;
      const maxAttempts = 30; // 6 seconds at 200ms intervals
      
      while (attempts < maxAttempts) {
        for (const selector of trainButtonSelectors) {
          try {
            const trainButton = await this.driver.$(selector);
            if (await trainButton.isExisting()) {
              await trainButton.click();
              console.log('[RailConnectPage] Train button clicked immediately');
              await this.driver.pause(1000); // Reduced from 2000ms to 1000ms
              return { success: true, message: 'Train button clicked successfully' };
            }
          } catch (e) {}
        }
        
        await this.driver.pause(200); // Reduced from 1000ms to 200ms
        attempts++;
      }
      
      throw new Error('Train button not found after 6 seconds');
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async bookTicketButton(){
    try{
      const bookticketButtonSelector='//android.widget.ImageView[@content-desc="Book Ticket"]';
      
      // Fast retry mechanism - check every 200ms for up to 6 seconds
      let attempts = 0;
      const maxAttempts = 30; // 6 seconds at 200ms intervals

      while(attempts < maxAttempts){
        try{
          const bookticketButton = await this.driver.$(bookticketButtonSelector);
          if(await bookticketButton.isExisting()){
            await bookticketButton.click();
            console.log('[RailConnectPage] Book Ticket button clicked immediately');
            await this.driver.pause(1000); // Reduced from 2000ms to 1000ms
            return {success: true, message: 'Book Ticket button clicked successfully'};
          }
        }catch(e){}
        
        await this.driver.pause(200); // Reduced from 1000ms to 200ms
        attempts++;
      }
      
      throw new Error('Book Ticket button not found after 6 seconds');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = RailConnectPage;