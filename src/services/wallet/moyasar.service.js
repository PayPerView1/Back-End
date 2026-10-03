// src/services/wallet/moyasar.service.js

const axios  = require('axios');
const crypto = require('crypto');

const MOYASAR_BASE_URL       = process.env.MOYASAR_BASE_URL;
const MOYASAR_SECRET_KEY     = process.env.MOYASAR_SECRET_KEY;
const MOYASAR_WEBHOOK_SECRET = process.env.MOYASAR_WEBHOOK_SECRET;

// ----------------------
// إنشاء Moyasar Invoice (Hosted Checkout)
// ----------------------
const createInvoice = async (amount, transactionId) => {
  const amountInSmallestUnit = Math.round(amount * 100);

  try {
    const response = await axios.post(
      `${MOYASAR_BASE_URL}/invoices`,
      {
        amount:       amountInSmallestUnit,
        currency:     'USD',
        description:  `Wallet top-up - ${transactionId}`,
        callback_url: process.env.MOYASAR_WEBHOOK_URL,
        success_url:  process.env.MOYASAR_SUCCESS_URL,
        back_url:     process.env.MOYASAR_BACK_URL,
        metadata: {
          transaction_id: transactionId,
        },
      },
      {
        auth: {
          username: MOYASAR_SECRET_KEY,
          password: '',
        },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return {
      invoiceId:  response.data.id,
      invoiceUrl: response.data.url, // ← الرابط الذي سيرسل للفرونت
      status:     response.data.status,
    };

  } catch (error) {
    console.error('[moyasar.service] createInvoice error:',
      JSON.stringify(error.response?.data, null, 2)
    );
    throw error;
  }
};

// ----------------------
// التحقق من صحة الـ Webhook Signature
// ----------------------
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!signatureHeader) return false;

  const expectedSignature = crypto
    .createHmac('sha256', MOYASAR_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
};

// ----------------------
// جلب تفاصيل Payment (للتحقق اليدوي)
// ----------------------
const getPayment = async (paymentId) => {
  const response = await axios.get(
    `${MOYASAR_BASE_URL}/payments/${paymentId}`,
    {
      auth: {
        username: MOYASAR_SECRET_KEY,
        password: '',
      },
    }
  );
  return response.data;
};

module.exports = {
  createInvoice,        // ← بدلاً من createPayment
  verifyWebhookSignature,
  getPayment,
};