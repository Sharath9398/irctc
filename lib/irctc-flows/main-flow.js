// lib/irctc-flows/main-flow.js
const LoginPage = require('./login-page');
const GeneratePinPage = require('./generate-pin-page');
const RailConnectPage = require('./rail-connect-page');
const TrainSearchPage = require('./train-search-page');

class MainFlow {
  constructor(driver) {
    this.driver = driver;
    this.loginPage = new LoginPage(driver);
    this.generatePinPage = new GeneratePinPage(driver);
    this.railConnectPage = new RailConnectPage(driver);
    this.trainSearchPage = new TrainSearchPage(driver);
  }

  async completeBooking(credentials, ticketData) {
    // Step 1: Login
    const loginResult = await this.loginPage.loginWithCaptcha(credentials.username, credentials.password);
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

    return { success: true, message: 'Booking flow completed successfully' };
  }
}

module.exports = MainFlow;