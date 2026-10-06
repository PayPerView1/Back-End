// src/routes/wallet/walletFunding.routes.js

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
  reviewBankTransfer,
} = require('../../controllers/wallet/walletFunding.controller');

const { protect }   = require('../../middlewares/authMiddleware');
const adminOnly     = require('../../middlewares/adminOnly');
const {
  validateFundingRequest,
  validateCapture,
  validateBankTransferUpload,
  validateReview,
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
//    قبل express.json، وإلا لن يعمل التحقق من التوقيع/التوكن:
//    app.use('/api/v1/wallet/paypal/webhook',  express.raw({ type: '*/*' }));
//    app.use('/api/v1/wallet/moyasar/webhook', express.raw({ type: '*/*' }));
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

// ----------------------------------------
// PUT /bank-transfer/:id  (مراجعة الأدمن: APPROVE / REJECT)
// ⚠️ المسار الفعلي يعتمد على مكان تركيب هذا الـ router في app.js:
//    تحت /api/v1/wallet  → /api/v1/wallet/bank-transfer/:id
//    تحت /api/v1/admin   → /api/v1/admin/bank-transfer/:id
//    راجع app.js وتأكد أنه يطابق ما يستدعيه الفرونت.
// ----------------------------------------
router.put(
  '/bank-transfer/:id',
  protect,
  adminOnly,
  validateReview,
  reviewBankTransfer
);

module.exports = router;