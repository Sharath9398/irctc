// lib/mobile-automation.js
const { remote } = require('webdriverio');
const { exec } = require('child_process');
const { promisify } = require('util');
const MainFlow = require('./irctc-flows/main-flow');

const execAsync = promisify(exec);

class MobileAutomation {
  constructor() {
    this.driver = null;
    this.isConnected = false;
    this.mainFlow = null;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.detectedDevice = null;
  }

  /**
   * Detect available Android devices (emulators and hardware)
   */
  async detectDevices() {
    try {
      const { stdout } = await execAsync('adb devices');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
      
      const devices = lines.map(line => {
        const [deviceId, status] = line.trim().split('\t');
        const isEmulator = deviceId.startsWith('emulator-');
        return { deviceId, status, isEmulator };
      }).filter(device => device.status === 'device');

      console.log('[Mobile] Detected devices:', devices);
      return devices;
    } catch (error) {
      console.error('[Mobile] Failed to detect devices:', error.message);
      return [];
    }
  }

  /**
   * Connect to mobile device via Appium server with automatic device detection
   */
  async connect() {
    try {
      // Detect available devices
      const devices = await this.detectDevices();
      
      if (devices.length === 0) {
        throw new Error('No Android devices found. Please connect a device or start an emulator.');
      }

      // Use the first available device
      this.detectedDevice = devices[0];
      console.log(`[Mobile] Using device: ${this.detectedDevice.deviceId} (${this.detectedDevice.isEmulator ? 'Emulator' : 'Hardware'})`);

      const capabilities = {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': this.detectedDevice.deviceId,
        'appium:udid': this.detectedDevice.deviceId,
        'appium:noReset': true,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 600,
        'appium:uiautomator2ServerInstallTimeout': 120000,
        'appium:uiautomator2ServerLaunchTimeout': 120000,
        'appium:skipServerInstallation': false,
        'appium:skipDeviceInitialization': false,
        'appium:systemPort': 8200 + Math.floor(Math.random() * 100)
      };
      
      console.log('[Mobile] Using capabilities:', JSON.stringify(capabilities, null, 2));

      this.driver = await remote({
        protocol: 'http',
        hostname: 'localhost',
        port: 4723,
        path: '/',
        capabilities,
        connectionRetryCount: 5,
        connectionRetryTimeout: 60000
      });

      this.isConnected = true;
      this.mainFlow = new MainFlow(this.driver);
      this.connectionRetries = 0;
      console.log(`[Mobile] Connected to ${this.detectedDevice.isEmulator ? 'emulator' : 'hardware device'} successfully`);
      return { 
        success: true, 
        message: `Connected to ${this.detectedDevice.isEmulator ? 'emulator' : 'hardware device'}: ${this.detectedDevice.deviceId}`,
        device: this.detectedDevice
      };

    } catch (error) {
      console.error('[Mobile] Connection failed:', error.message);
      this.isConnected = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if driver is still responsive and reconnect if needed
   */
  async ensureConnection() {
    try {
      if (!this.driver || !this.isConnected) {
        throw new Error('Driver not connected');
      }
      
      // Test driver responsiveness with a simple command
      await this.driver.getCurrentActivity();
      return { success: true };
    } catch (error) {
      console.log('[Mobile] Connection lost, attempting to reconnect...');
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        await this.forceDisconnect();
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        const reconnectResult = await this.connect();
        
        if (reconnectResult.success) {
          console.log(`[Mobile] Reconnected successfully (attempt ${this.connectionRetries}/${this.maxRetries})`);
          return { success: true };
        }
      }
      
      return { success: false, error: 'Failed to restore connection after ' + this.maxRetries + ' attempts' };
    }
  }

  /**
   * Force disconnect without throwing errors
   */
  async forceDisconnect() {
    try {
      if (this.driver) {
        await this.driver.deleteSession();
      }
    } catch (error) {
      console.log('[Mobile] Force disconnect error (ignored):', error.message);
    } finally {
      this.driver = null;
      this.isConnected = false;
      this.mainFlow = null;
    }
  }

  /**
   * Get information about the currently connected device
   */
  getDeviceInfo() {
    return this.detectedDevice;
  }

  /**
   * Disconnect from mobile device
   */
  async disconnect() {
    try {
      if (this.driver) {
        await this.driver.deleteSession();
        this.driver = null;
      }
      this.isConnected = false;
      this.mainFlow = null;
      this.detectedDevice = null;
      console.log('[Mobile] Disconnected from device');
      return { success: true };
    } catch (error) {
      console.error('[Mobile] Disconnect error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute booking flow with CAPTCHA automation and connection recovery
   */
  async completeBookingFlow(credentials, ticketData, useAutoCaptcha = true) {
    if (!this.isConnected || !this.driver || !this.mainFlow) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    try {
      const result = await this.mainFlow.completeBooking(credentials, ticketData, useAutoCaptcha);
      this.connectionRetries = 0;
      return result;
    } catch (error) {
      // Handle UiAutomator2 crashes
      if (this.isUiAutomator2Error(error)) {
        console.log('[Mobile] UiAutomator2 crash detected, attempting recovery...');
        
        const recoveryResult = await this.ensureConnection();
        if (recoveryResult.success) {
          console.log('[Mobile] Connection recovered, retrying booking flow...');
          try {
            return await this.mainFlow.completeBooking(credentials, ticketData, useAutoCaptcha);
          } catch (retryError) {
            return { success: false, error: 'Retry failed after recovery: ' + retryError.message };
          }
        } else {
          return { success: false, error: 'UiAutomator2 crashed and recovery failed: ' + recoveryResult.error };
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Login with automatic CAPTCHA solving and connection recovery
   */
  async loginWithCaptcha(username, password, pin = null, useAutoCaptcha = true) {
    if (!this.isConnected || !this.driver) {
      return { success: false, error: 'Device not connected. Call connect() first.' };
    }

    const LoginPage = require('./irctc-flows/login-page');
    const loginPage = new LoginPage(this.driver);
    
    try {
      const result = await loginPage.loginWithCaptcha(
        username, 
        password, 
        '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
        useAutoCaptcha
      );
      
      this.connectionRetries = 0;
      return result;
    } catch (error) {
      // Handle UiAutomator2 crashes
      if (this.isUiAutomator2Error(error)) {
        console.log('[Mobile] UiAutomator2 crash detected during login, attempting recovery...');
        
        const recoveryResult = await this.ensureConnection();
        if (recoveryResult.success) {
          console.log('[Mobile] Connection recovered, retrying login...');
          try {
            const newLoginPage = new LoginPage(this.driver);
            return await newLoginPage.loginWithCaptcha(
              username, 
              password, 
              '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
              useAutoCaptcha
            );
          } catch (retryError) {
            return { success: false, error: 'Login retry failed after recovery: ' + retryError.message };
          }
        } else {
          return { success: false, error: 'UiAutomator2 crashed during login and recovery failed: ' + recoveryResult.error };
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if error is related to UiAutomator2 crash
   */
  isUiAutomator2Error(error) {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('uiautomator2') || 
           errorMessage.includes('instrumentation process') ||
           errorMessage.includes('cannot be proxied') ||
           errorMessage.includes('probably crashed');
  }
}

module.exports = MobileAutomation;