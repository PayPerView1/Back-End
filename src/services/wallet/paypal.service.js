// src/services/wallet/paypal.service.js

const axios = require('axios');

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// ----------------------
// الحصول على Access Token
// ----------------------
const getAccessToken = async () => {
  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  return response.data.access_token;
};

// ----------------------
// إنشاء PayPal Order
// ----------------------
const createOrder = async (amount, transactionId) => {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
          },
          custom_id: transactionId, // نحفظ transactionId هنا لنرجعه في الـ webhook
        },
      ],
      application_context: {
        brand_name: 'Pay Per View',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL}/wallet/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/wallet/payment/cancel`,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // استخراج رابط الـ redirect
  const approveLink = response.data.links.find(
    (link) => link.rel === 'approve'
  );

  return {
    orderId: response.data.id,
    redirectUrl: approveLink.href,
  };
};

// ----------------------
// التحقق من صحة الـ Webhook Signature
// ----------------------
const verifyWebhookSignature = async (headers, rawBody) => {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      transmission_sig: headers['paypal-transmission-sig'],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // PayPal يرجع SUCCESS إذا كان الـ signature صحيحاً
  return response.data.verification_status === 'SUCCESS';
};

// ----------------------
// Capture PayPal Order
// (يُستدعى بعد موافقة المستخدم على الدفع)
// ----------------------
const captureOrder = async (orderId) => {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

module.exports = {
  getAccessToken,
  createOrder,
  verifyWebhookSignature,
  captureOrder,
};