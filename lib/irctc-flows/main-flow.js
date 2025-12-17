// lib/irctc-flows/main-flow.js
const LoginPage = require('./login-page');
const GeneratePinPage = require('./generate-pin-page');
const RailConnectPage = require('./rail-connect-page');
const TrainSearchPage = require('./train-search-page');
const TrainListPage = require('./train-list-page');

class MainFlow {
  constructor(driver) {
    this.driver = driver;
    this.loginPage = new LoginPage(driver);
    this.generatePinPage = new GeneratePinPage(driver);
    this.railConnectPage = new RailConnectPage(driver);
    this.trainSearchPage = new TrainSearchPage(driver);
    this.trainListPage = new TrainListPage(driver);
  }

  async completeBooking(credentials, ticketData, useAutoCaptcha = true) {
    // Step 1: Login
    const loginResult = await this.loginPage.loginWithCaptcha(
      credentials.username, 
      credentials.password, 
      '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
      useAutoCaptcha
    );
    if (!loginResult.success) return loginResult;

    // Step 2: Setup PIN (if required)
    if (credentials.pin) {
      const pinResult = await this.generatePinPage.setupPin(credentials.pin);
      if (!pinResult.success) return pinResult;
    }

    // Step 3: Navigate to train booking
    const trainResult = await this.railConnectPage.clickTrainButton();
    if (!trainResult.success) return trainResult;

    const bookTicketResult = await this.railConnectPage.bookTicketButton();
    if (!bookTicketResult.success) return bookTicketResult;

    // Step 4: Search trains
    const searchResult = await this.trainSearchPage.serachTrain(
      ticketData.fromStation, 
      ticketData.toStation, 
      ticketData.travelDate
    );
    if (!searchResult.success) return searchResult;

    // Step 5: Select train from list
    const trainSelectResult = await this.trainListPage.selectTrainByNumber(ticketData.trainNumber, ticketData.trainName);
    if (!trainSelectResult.success) return trainSelectResult;

    // Step 6: Select train class
    if (ticketData.trainClass) {
      const classSelectResult = await this.trainListPage.selectTrainClass(ticketData.trainClass);
      if (!classSelectResult.success) return classSelectResult;
    }

    return { success: true, message: 'Booking flow completed successfully' };
  }
}

module.exports = MainFlow;