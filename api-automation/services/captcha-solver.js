const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

class CaptchaSolver {
    constructor() {
        this.worker = null;
    }

    async initWorker() {
        if (!this.worker) {
            this.worker = await createWorker('eng');
            // Tesseract configuration for better captcha accuracy
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                tessedit_pageseg_mode: '7', // Treat the image as a single text line
            });
        }
    }

    async solveCaptcha(base64Image) {
        try {
            await this.initWorker();
            const buffer = Buffer.from(base64Image, 'base64');

            // Strategy: Extreme Contrast & Sharpness
            // This removes the gray background and makes characters solid black/white
            const processedBuffer = await sharp(buffer)
                .ensureAlpha()
                .extractChannel('green') // Green channel usually has best contrast for IRCTC
                .negate()                // Flip colors if the background is dark
                .threshold(150)          // Harsh binary threshold to remove noise
                .linear(2, -0.5)         // Increase contrast
                .sharpen()
                .resize(600, null, { kernel: sharp.kernel.lanczos3 }) // Smooth scaling
                .toBuffer();

            const { data: { text } } = await this.worker.recognize(processedBuffer);
            
            // Post-processing cleanup
            let cleanText = text.replace(/[^a-zA-Z0-9]/g, '').trim();

            // Common IRCTC OCR Fixes
            cleanText = cleanText.replace(/0/g, 'O'); // IRCTC often uses O instead of 0
            cleanText = cleanText.replace(/1/g, 'I');
            cleanText = cleanText.replace(/\]/g, 'J');

            console.log(`🔍 OCR Result: ${cleanText}`);
            
            if (cleanText.length >= 4) {
                return { success: true, text: cleanText };
            }
            
            return { success: false, error: 'Incomplete extraction' };

        } catch (error) {
            console.error('❌ Solver error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

module.exports = CaptchaSolver;