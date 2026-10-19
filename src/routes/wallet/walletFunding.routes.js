// src/routes/wallet/walletFunding.routes.js
//
// يُركَّب في app.js مرة واحدة فقط:  app.use('/api/v1/wallet', walletFundingRoutes);
// (مسار مراجعة التحويل البنكي للأدمن انتقل إلى admin/walletAdmin.routes.js)

const express = require('express');
const router  = express.Router();

const {
  getWallet,
  getBankDetails,
  initiateFunding,
  capturePaypalOrder,
  handlePaypalWebhook,
  handleMoyasarWebhook,
  uploadBankTransferReceipt,
} = require('../../controllers/wallet/walletFunding.controller');

const { protect }   = require('../../middlewares/authMiddleware');
const {
  validateFundingRequest,
  validateCapture,
  validateBankTransferUpload,
} = require('../../middlewares/wallet/walletValidation.middleware');
const uploadReceipt = require('../../middlewares/wallet/receiptUpload.middleware');

// ----------------------------------------
// GET /api/v1/wallet
// ----------------------------------------
router.get('/', protect, getWallet);

// ----------------------------------------
// GET /api/v1/wallet/bank-details
// ----------------------------------------
router.get('/bank-details', protect, getBankDetails);

// ----------------------------------------
// POST /api/v1/wallet/fund
// ----------------------------------------
router.post('/fund', protect, validateFundingRequest, initiateFunding);

// ----------------------------------------
// POST /api/v1/wallet/paypal/capture
// يُستدعى من صفحة النجاح بعد عودة المستخدم من PayPal
// body: { orderId }  ← قيمة ?token= من الـ return_url
// ----------------------------------------
router.post('/paypal/capture', protect, validateCapture, capturePaypalOrder);

// ----------------------------------------
// Webhooks — بدون protect (البوابة تستدعيها مباشرة)
// ⚠️ يجب ضبط express.raw على هذين المسارين في app.js
//    قبل express.json، وإلا لن يعمل التحقق من التوقيع/التوكن
//    (الإعداد الحالي في app.js: express.raw({ type: 'application/json' })):
//    app.use('/api/v1/wallet/paypal/webhook',  express.raw({ type: 'application/json' }));
//    app.use('/api/v1/wallet/moyasar/webhook', express.raw({ type: 'application/json' }));
// ----------------------------------------
// POST /api/v1/wallet/paypal/webhook
router.post('/paypal/webhook', handlePaypalWebhook);

// POST /api/v1/wallet/moyasar/webhook
router.post('/moyasar/webhook', handleMoyasarWebhook);

// ----------------------------------------
// POST /api/v1/wallet/bank-transfer/upload
// ----------------------------------------
router.post(
  '/bank-transfer/upload',
  protect,
  uploadReceipt,
  validateBankTransferUpload,
  uploadBankTransferReceipt
);

module.exports = router;