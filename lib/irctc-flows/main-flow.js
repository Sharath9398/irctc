// lib/irctc-flows/main-flow.js
const LoginPage = require('./login-page');
const GeneratePinPage = require('./generate-pin-page');
const RailConnectPage = require('./rail-connect-page');
const TrainSearchPage = require('./train-search-page');
const TrainListPage = require('./train-list-page');
const PassengerDetailsPage = require('./passenger-details-page');
const ReviewJourneyPage = require('./review-journey-page');
const PayUsingUpiPage = require('./pay-using-upi-page');

class MainFlow {
  constructor(driver) {
    this.driver = driver;
    this.loginPage = new LoginPage(driver);
    this.generatePinPage = new GeneratePinPage(driver);
    this.railConnectPage = new RailConnectPage(driver);
    this.trainSearchPage = new TrainSearchPage(driver);
    this.trainListPage = new TrainListPage(driver);
    this.passengerDetailsPage = new PassengerDetailsPage(driver);
    this.reviewJourneyPage = new ReviewJourneyPage(driver);
    this.payUsingUpiPage = new PayUsingUpiPage(driver);
  }

  async completeBooking(credentials, ticketData, useAutoCaptcha = true) {
    // Step 0: Initial App Navigation (Click OK then Login)
    // Based on user's updated flow requirement
    const okResult = await this.loginPage.clickOkButton();
    // We log but continue even if OK button isn't found (it might be transient)
    if (!okResult.success) console.log('[MainFlow] OK button step skipped or failed:', okResult.error);

    const navLoginResult = await this.loginPage.clickTopLoginButton();
    if (!navLoginResult.success) return navLoginResult;

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

    // Step 7: Click continue to passenger details
    const continueResult = await this.trainListPage.clickContinue();
    if (!continueResult.success) return continueResult;

    // Step 8: Handle optional warning alert
    const alertResult = await this.trainListPage.handleWarningAlert();
    if (!alertResult.success) return alertResult;

    // Step 9: Add all passengers from saved ticket
    let passengers = [];
    if (ticketData.passengers) {
      try {
        passengers = typeof ticketData.passengers === 'string' ? JSON.parse(ticketData.passengers) : ticketData.passengers;
      } catch (e) {
        console.log('[DEBUG] Failed to parse passengers data:', e.message);
      }
    }

    if (passengers && passengers.length > 0) {
      const passengersResult = await this.passengerDetailsPage.addAllPassengers(passengers);
      if (!passengersResult.success) return passengersResult;
    } else {
      // Create test passenger data for testing
      const testPassengers = [
        {
          name: "Test User",
          age: 30,
          gender: "Male",
          berth: "Lower",
          food: "Veg"
        }
      ];

      const passengersResult = await this.passengerDetailsPage.addAllPassengers(testPassengers);
      if (!passengersResult.success) return passengersResult;
    }

    // Step 10: Handle auto-upgrade and payment options
    const optionsResult = await this.passengerDetailsPage.scrollToBottomAndHandleOptions(ticketData);
    if (!optionsResult.success) return optionsResult;

    // Step 11: Solve captcha and proceed to payment
    const reviewResult = await this.reviewJourneyPage.solveCaptchaAndProceed();
    if (!reviewResult.success) return reviewResult;

    // Step 12: Handle UPI Payment
    if (ticketData.payment_type === 'bank' && ticketData.payment_gateway) {
      const upiPaymentResult = await this.payUsingUpiPage.selectProviderAndPay(ticketData.payment_gateway, ticketData.upi_id, ticketData);
      if (!upiPaymentResult.success) return upiPaymentResult;
    }

    return { success: true, message: 'Booking flow completed successfully' };
  }
}

module.exports = MainFlow;