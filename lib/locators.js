module.exports = {
    // Global/Common android widgets
    COMMON: {
        BUTTON_1: '//android.widget.Button[@resource-id="android:id/button1"]', // Typical "OK" or "YES" button
        MESSAGE: '//android.widget.TextView[@resource-id="android:id/message"]',
    },

    LOGIN_PAGE: {
        // Initial Navigation
        TOP_LOGIN_BUTTON_ID: '//android.widget.TextView[@resource-id="cris.org.in.prs.ima:id/tv_action_right1"]',
        TOP_LOGIN_BUTTON_TEXT: '//android.widget.TextView[@text="LOGIN"]',

        // Login Form
        USERNAME_FIELD_FALLBACKS: [
            '//android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.RelativeLayout[1]/android.widget.LinearLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout//android.widget.EditText',
            '//android.widget.EditText[1]',
            'android=new UiSelector().className("android.widget.EditText").instance(0)'
        ],
        USERNAME_FIELD_ID: '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/et_username"]', // Added based on Java code provided earlier, simpler if it works

        PASSWORD_FIELD_FALLBACKS: [
            '//android.widget.LinearLayout[@resource-id="cris.org.in.prs.ima:id/til_password"]//android.widget.EditText',
            '//android.widget.EditText[2]',
            'android=new UiSelector().className("android.widget.EditText").instance(1)'
        ],

        CAPTCHA_INPUT_ID: '//android.widget.EditText[@resource-id="cris.org.in.prs.ima:id/tv_captcha_input"]',
        CAPTCHA_IMAGE_ID: '//android.widget.ImageView[@resource-id="cris.org.in.prs.ima:id/captcha"]',
        CAPTCHA_REFRESH_ID: '//android.view.View[@content-desc="captcha refresh"]',

        LOGIN_SUBMIT_BUTTON: '//android.widget.TextView[@text="LOGIN"]', // The button at the bottom of form

        // Error Validations
        ERROR_MESSAGES: [
            '//android.widget.TextView[contains(@text, "Invalid")]',
            '//android.widget.TextView[contains(@text, "Error")]',
            '//android.widget.TextView[contains(@text, "Failed")]',
            '//android.widget.TextView[contains(@text, "incorrect")]'
        ]
    },

    PASSENGER_PAGE: {
        // placeholders for future refactoring
    }
};
