// src/services/wallet/moyasar.service.js

const axios  = require('axios');
const crypto = require('crypto');

// نقرأ الإعدادات عند الاستخدام وليس عند تحميل الملف
const cfg = () => ({
  baseUrl:       process.env.MOYASAR_BASE_URL,
  secretKey:     process.env.MOYASAR_SECRET_KEY,
  webhookSecret: process.env.MOYASAR_WEBHOOK_SECRET,
});

const basicAuth = () => ({ username: cfg().secretKey, password: '' });

// ----------------------
// إنشاء Moyasar Invoice (Hosted Checkout)
// ----------------------
const createInvoice = async (amount, transactionId) => {
  const amountInSmallestUnit = Math.round(Number(amount) * 100);

  const payload = {
    amount:       amountInSmallestUnit,
    currency:     'USD',
    description:  `Wallet top-up - ${transactionId}`,
    // لا نضع callback_url: Moyasar يرسل إليه "invoice object" بدون secret_token
    // الإشعار يصلنا عبر الـ webhook المسجّل في لوحة Moyasar (حدث payment_paid)
    success_url:  process.env.MOYASAR_SUCCESS_URL,
    back_url:     process.env.MOYASAR_BACK_URL,
    metadata: {
      transaction_id: transactionId,
    },
  };

  // اختياري: صلاحية الفاتورة بالساعات (مثلاً MOYASAR_INVOICE_EXPIRY_HOURS=24)
  // لا يُرسل إلا إذا ضبطته، وتحقق من قبول Moyasar له في sandbox
  const expiryHours = Number(process.env.MOYASAR_INVOICE_EXPIRY_HOURS);
  if (expiryHours > 0) {
    payload.expired_at = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
  }

  try {
    const response = await axios.post(
      `${cfg().baseUrl}/invoices`,
      payload,
      {
        auth:    basicAuth(),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return {
      invoiceId:  response.data.id,
      invoiceUrl: response.data.url, // الرابط الذي يُرسل للفرونت
      status:     response.data.status,
    };
  } catch (error) {
    console.error(
      '[moyasar.service] createInvoice error:',
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    throw error;
  }
};

// ----------------------
// التحقق من الـ Webhook
// Moyasar لا يرسل HMAC في header؛ يضع الـ secret_token داخل جسم الطلب
// (القيمة التي سجّلتها في Dashboard → Settings → Webhooks)
// ----------------------
const verifyWebhookToken = (secretToken) => {
  const { webhookSecret } = cfg();
  if (!secretToken || !webhookSecret) return false;

  const received = Buffer.from(String(secretToken));
  const expected = Buffer.from(webhookSecret);

  // timingSafeEqual يرمي خطأ إذا اختلف الطول، لذلك نفحصه أولاً
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

// ----------------------
// جلب تفاصيل Payment
// نستخدمه للتحقق من حالة الدفعة ومبلغها من Moyasar مباشرة
// ----------------------
const getPayment = async (paymentId) => {
  if (!paymentId) throw new Error('paymentId is required');

  try {
    const response = await axios.get(
      `${cfg().baseUrl}/payments/${encodeURIComponent(paymentId)}`,
      { auth: basicAuth() }
    );
    return response.data;
  } catch (error) {
    console.error(
      '[moyasar.service] getPayment error:',
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    throw error;
  }
};

module.exports = {
  createInvoice,
  verifyWebhookToken,
  getPayment,
};