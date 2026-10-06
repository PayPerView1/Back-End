// src/services/wallet/paypal.service.js

const axios = require('axios');

// نقرأ الإعدادات عند الاستخدام وليس عند تحميل الملف
// (يتجنب مشكلة ترتيب تحميل dotenv)
const cfg = () => ({
  baseUrl:      process.env.PAYPAL_BASE_URL,
  clientId:     process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  webhookId:    process.env.PAYPAL_WEBHOOK_ID,
});

const logPaypalError = (label, error) => {
  console.error(
    `[paypal.service] ${label} error:`,
    JSON.stringify(error.response?.data || error.message, null, 2)
  );
};

// ----------------------
// الحصول على Access Token (مع كاش حتى قرب انتهاء الصلاحية)
// ----------------------
let cachedToken  = null; // { value, expiresAt }
let tokenPromise = null; // يمنع طلبات token متزامنة

const getAccessToken = async () => {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const { baseUrl, clientId, clientSecret } = cfg();
      const response = await axios.post(
        `${baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: clientId, password: clientSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token, expires_in } = response.data;
      // نجدد قبل الانتهاء بدقيقة
      cachedToken = {
        value:     access_token,
        expiresAt: Date.now() + Math.max(expires_in - 60, 30) * 1000,
      };
      return access_token;
    } catch (error) {
      logPaypalError('getAccessToken', error);
      throw error;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
};

// ----------------------
// Helper: طلب مصادَق إلى PayPal
// عند 401 (token مرفوض) نمسح الكاش ونعيد المحاولة مرة واحدة
// ----------------------
const paypalRequest = async (label, config, canRetry = true) => {
  const token = await getAccessToken();

  try {
    const response = await axios({
      baseURL: cfg().baseUrl,
      ...config,
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401 && canRetry) {
      cachedToken = null;
      return paypalRequest(label, config, false);
    }
    logPaypalError(label, error);
    throw error;
  }
};

// ----------------------
// إنشاء PayPal Order
// PayPal-Request-Id: إعادة المحاولة لنفس الـ transaction لا تنشئ order ثانية
// ----------------------
const createOrder = async (amount, transactionId) => {
  const data = await paypalRequest('createOrder', {
    method: 'post',
    url:    '/v2/checkout/orders',
    headers: { 'PayPal-Request-Id': `order-${transactionId}` },
    data: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: Number(amount).toFixed(2),
          },
          custom_id: transactionId, // نرجع به في الـ webhook
        },
      ],
      application_context: {
        brand_name:   'Pay Per View',
        landing_page: 'BILLING',
        user_action:  'PAY_NOW',
        return_url:   `${process.env.FRONTEND_URL}/advertiser/wallet/payment/success`,
        cancel_url:   `${process.env.FRONTEND_URL}/advertiser/wallet/payment/cancel`,
      },
    },
  });

  const approveLink = data.links?.find(
    (link) => link.rel === 'approve' || link.rel === 'payer-action'
  );
  if (!approveLink) {
    throw new Error('PayPal approve link not found in createOrder response');
  }

  return {
    orderId:     data.id,
    redirectUrl: approveLink.href,
  };
};

// ----------------------
// التحقق من صحة الـ Webhook Signature
// rawBody: Buffer (من express.raw) أو string
// ----------------------
const verifyWebhookSignature = async (headers, rawBody) => {
  const { webhookId } = cfg();
  if (!webhookId) {
    console.error('[paypal.service] PAYPAL_WEBHOOK_ID is not set');
    return false;
  }

  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);

  const data = await paypalRequest('verifyWebhookSignature', {
    method: 'post',
    url:    '/v1/notifications/verify-webhook-signature',
    data: {
      webhook_id:        webhookId,
      webhook_event:     JSON.parse(bodyText),
      cert_url:          headers['paypal-cert-url'],
      auth_algo:         headers['paypal-auth-algo'],
      transmission_id:   headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      transmission_sig:  headers['paypal-transmission-sig'],
    },
  });

  return data.verification_status === 'SUCCESS';
};

// ----------------------
// Capture PayPal Order
// (يُستدعى بعد موافقة المستخدم على الدفع)
// ----------------------
const captureOrder = (orderId) =>
  paypalRequest('captureOrder', {
    method: 'post',
    url:    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    headers: { 'PayPal-Request-Id': `capture-${orderId}` },
    data:   {},
  });

// ----------------------
// جلب تفاصيل Order
// (يُستخدم عند ORDER_ALREADY_CAPTURED لمعرفة الحالة الحالية)
// ----------------------
const getOrder = (orderId) =>
  paypalRequest('getOrder', {
    method: 'get',
    url:    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
  });

module.exports = {
  getAccessToken,
  createOrder,
  verifyWebhookSignature,
  captureOrder,
  getOrder,
};