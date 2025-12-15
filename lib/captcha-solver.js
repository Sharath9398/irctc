const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

class CaptchaSolver {
  constructor(driver) {
    this.driver = driver;
  }

  async solveCaptcha(selector) {
    try {
      const element = await this.driver.$(selector);
      const { x, y } = await element.getLocation();
      const { width, height } = await element.getSize();
      
      const screenshot = await this.driver.takeScreenshot();
      const baseBuffer = Buffer.from(screenshot, 'base64');
      
      // Try 3 different approaches
      const approaches = [
        // 1. Raw image
        sharp(baseBuffer).extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) }).png(),
        // 2. Simple 2x scale
        sharp(baseBuffer).extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) }).resize(width * 2, height * 2).png(),
        // 3. Enhanced processing
        sharp(baseBuffer).extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) }).resize(width * 3, height * 3).normalize().png()
      ];
      
      for (const approach of approaches) {
        try {
          const buffer = await approach.toBuffer();
          
          const worker = await createWorker('eng');
          const { data: { text } } = await worker.recognize(buffer);
          await worker.terminate();
          
          let cleanText = text.replace(/\s/g, '').trim();
          
          // Fix OCR errors - IRCTC CAPTCHAs never have brackets
          cleanText = cleanText.replace(/\]/g, 'J');
          
          if (cleanText.length >= 4) {
            return { success: true, text: cleanText };
          }
        } catch (e) {}
      }
      
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = CaptchaSolver;