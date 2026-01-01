const axios = require('axios');

/**
 * Paytm UPI Payment Handler
 * Handles Paytm UPI payment processing for IRCTC bookings
 */
class PaytmUPIHandler {
    constructor(merchantId, orderId, txnToken) {
        this.merchantId = merchantId;
        this.orderId = orderId;
        this.txnToken = txnToken;
        this.client = axios.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    async getPaymentOptions() {
        try {
            console.log('Getting Paytm payment options...');
            
            const payload = {
                head: {
                    version: 'v1',
                    requestTimestamp: new Date().toISOString(),
                    channelId: 'WEB',
                    token: this.txnToken,
                    tokenType: 'TXN_TOKEN',
                    txnToken: this.txnToken,
                    workFlow: 'NATIVE',
                    showLoader: true
                },
                body: {
                    mid: this.merchantId,
                    orderId: this.orderId,
                    payMethods: [{
                        payMethod: 'UPI',
                        payOption: 'UPI',
                        upiModeSubTypes: ['UPI_COLLECT', 'UPI_INTENT', 'UPI_QR']
                    }]
                }
            };

            const response = await this.client.post(
                `https://secure.paytmpayments.com/pg/v1/pay/${this.merchantId}/${this.orderId}`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Referer': 'https://secure.paytmpayments.com/'
                    }
                }
            );

            if (response.data) {
                console.log('✅ Payment options retrieved');
                return { success: true, data: response.data };
            }

            return { success: false, error: 'No payment options received' };

        } catch (error) {
            console.error('Payment options error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async validateVPA(vpaAddress) {
        try {
            console.log(`Validating VPA: ${vpaAddress}...`);
            
            const payload = {
                head: {
                    version: 'v1',
                    requestTimestamp: new Date().toISOString(),
                    channelId: 'WEB',
                    workFlow: 'NATIVE',
                    tokenType: 'TXN_TOKEN',
                    token: this.txnToken,
                    txnToken: this.txnToken
                },
                body: {
                    vpa: vpaAddress,
                    mid: this.merchantId,
                    orderId: this.orderId
                }
            };

            const response = await this.client.post(
                `https://secure.paytmpayments.com/pg/v1/pay/${this.merchantId}/${this.orderId}/validateVpa`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Referer': 'https://secure.paytmpayments.com/'
                    }
                }
            );

            if (response.data && response.data.body) {
                const isValid = response.data.body.resultInfo?.resultStatus === 'SUCCESS';
                console.log(`VPA validation: ${isValid ? '✅' : '❌'}`);
                return { success: true, valid: isValid, data: response.data };
            }

            return { success: false, error: 'Invalid VPA response' };

        } catch (error) {
            console.error('VPA validation error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async processUPITransaction(vpaAddress, amount) {
        try {
            console.log(`Processing UPI transaction for ${amount}...`);
            
            const payload = {
                head: {
                    version: 'v1',
                    channelId: 'WEB',
                    workFlow: 'NATIVE',
                    tokenType: 'TXN_TOKEN',
                    requestTimestamp: new Date().toISOString(),
                    txnToken: this.txnToken,
                    token: this.txnToken
                },
                body: {
                    paymentMode: 'UPI',
                    requestType: 'NATIVE',
                    authMode: '3D',
                    paymentFlow: 'UPI_COLLECT',
                    selectedPaymentModeId: 2,
                    payerAccount: vpaAddress,
                    mid: this.merchantId,
                    orderId: this.orderId,
                    riskExtendInfo: `amount=${amount}`
                },
                showPostFetchLoader: false
            };

            const response = await this.client.post(
                `https://secure.paytmpayments.com/pg/v1/pay/${this.merchantId}/${this.orderId}/processTransaction`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Referer': 'https://secure.paytmpayments.com/'
                    }
                }
            );

            if (response.data) {
                console.log('✅ UPI transaction initiated');
                return { 
                    success: true, 
                    data: response.data,
                    transactionId: response.data.body?.transId,
                    cashierRequestId: response.data.body?.cashierRequestId
                };
            }

            return { success: false, error: 'No transaction response' };

        } catch (error) {
            console.error('UPI transaction error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async pollTransactionStatus(transactionId, cashierRequestId, maxPolls = 60) {
        try {
            console.log('Polling transaction status...');
            
            for (let i = 0; i < maxPolls; i++) {
                console.log(`Poll ${i + 1}/${maxPolls}...`);
                
                const formData = new URLSearchParams();
                formData.append('MID', this.merchantId);
                formData.append('ORDER_ID', this.orderId);
                formData.append('merchantId', this.merchantId);
                formData.append('orderId', this.orderId);
                formData.append('transId', transactionId);
                formData.append('cashierRequestId', cashierRequestId);
                formData.append('paymentMode', 'UPI');
                formData.append('vpaID', 'user@paytm');
                formData.append('isSelfPush', 'false');
                formData.append('upiAccepted', 'true');
                formData.append('STATUS_INTERVAL', '3000');
                formData.append('STATUS_TIMEOUT', '300000');

                const response = await this.client.post(
                    `https://secure.paytmpayments.com/pg/v1/status/${this.merchantId}/${this.orderId}`,
                    formData,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': 'https://secure.paytmpayments.com/'
                        }
                    }
                );

                if (response.data) {
                    const status = this.parseStatusResponse(response.data);
                    
                    if (status.isFinal) {
                        console.log(`Transaction ${status.isSuccess ? 'successful' : 'failed'}: ${status.message}`);
                        return {
                            success: true,
                            isFinal: true,
                            isSuccess: status.isSuccess,
                            message: status.message,
                            data: response.data
                        };
                    }
                }

                // Wait 3 seconds before next poll
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            console.log('⏰ Transaction status polling timeout');
            return {
                success: false,
                error: 'Transaction status polling timeout',
                isFinal: false
            };

        } catch (error) {
            console.error('Status polling error:', error.message);
            return { success: false, error: error.message };
        }
    }

    parseStatusResponse(responseData) {
        // Parse HTML or JSON response to extract transaction status
        try {
            if (typeof responseData === 'string') {
                // HTML response parsing
                if (responseData.includes('TXN_SUCCESS') || responseData.includes('SUCCESS')) {
                    return { isFinal: true, isSuccess: true, message: 'Transaction successful' };
                } else if (responseData.includes('TXN_FAILURE') || responseData.includes('FAILED')) {
                    return { isFinal: true, isSuccess: false, message: 'Transaction failed' };
                } else if (responseData.includes('PENDING')) {
                    return { isFinal: false, isSuccess: false, message: 'Transaction pending' };
                }
            } else if (typeof responseData === 'object') {
                // JSON response parsing
                const status = responseData.body?.resultInfo?.resultStatus;
                if (status === 'SUCCESS' || status === 'TXN_SUCCESS') {
                    return { isFinal: true, isSuccess: true, message: 'Transaction successful' };
                } else if (status === 'FAILURE' || status === 'TXN_FAILURE') {
                    return { isFinal: true, isSuccess: false, message: 'Transaction failed' };
                }
            }

            return { isFinal: false, isSuccess: false, message: 'Transaction in progress' };

        } catch (error) {
            console.error('Status parsing error:', error.message);
            return { isFinal: false, isSuccess: false, message: 'Status unknown' };
        }
    }

    async processCompleteUPIPayment(vpaAddress, amount) {
        try {
            console.log('\n💳 Starting complete UPI payment process...');
            
            // Step 1: Get payment options
            const optionsResult = await this.getPaymentOptions();
            if (!optionsResult.success) {
                return { success: false, error: 'Failed to get payment options: ' + optionsResult.error };
            }

            // Step 2: Validate VPA
            const vpaResult = await this.validateVPA(vpaAddress);
            if (!vpaResult.success || !vpaResult.valid) {
                return { success: false, error: 'Invalid UPI ID: ' + vpaAddress };
            }

            // Step 3: Process transaction
            const transactionResult = await this.processUPITransaction(vpaAddress, amount);
            if (!transactionResult.success) {
                return { success: false, error: 'Transaction initiation failed: ' + transactionResult.error };
            }

            // Step 4: Poll for status
            const statusResult = await this.pollTransactionStatus(
                transactionResult.transactionId,
                transactionResult.cashierRequestId
            );

            if (statusResult.success && statusResult.isFinal) {
                return {
                    success: statusResult.isSuccess,
                    message: statusResult.message,
                    transactionId: transactionResult.transactionId,
                    cashierRequestId: transactionResult.cashierRequestId,
                    finalStatus: statusResult
                };
            }

            return {
                success: false,
                error: 'Payment processing incomplete or failed',
                transactionId: transactionResult.transactionId
            };

        } catch (error) {
            console.error('Complete UPI payment error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = PaytmUPIHandler;