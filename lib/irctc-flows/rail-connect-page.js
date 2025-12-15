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
      
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        for (const selector of trainButtonSelectors) {
          try {
            const trainButton = await this.driver.$(selector);
            if (await trainButton.isExisting()) {
              await trainButton.click();
              await this.driver.pause(2000);
              return { success: true, message: 'Train button clicked successfully' };
            }
          } catch (e) {}
        }
        
        await this.driver.pause(1000);
        attempts++;
      }
      
      throw new Error('Train button not found after 15 seconds');
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async bookTicketButton(){
    try{
      const bookticketButtonSelector='//android.widget.ImageView[@content-desc="Book Ticket"]';
      let attempts=0;

      const maxAttempts=15;

      while(attempts<maxAttempts){
        try{
          const bookticketButton=await this.driver.$(bookticketButtonSelector);
          if(await bookticketButton.isExisting()){
            await bookticketButton.click();
            await this.driver.pause(2000);
            return {success:true,message:'Book Ticket button clicked successfully'};
          }
        }catch(e){}
        await this.driver.pause(1000);
        attempts++;
      }
      throw new Error('Book Ticket button not found after 15 seconds');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = RailConnectPage;