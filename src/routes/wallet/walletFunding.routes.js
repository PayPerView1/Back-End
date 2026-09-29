// src/routes/wallet/walletFunding.routes.js
const express = require('express');
const router = express.Router();

const {
  getWallet,
  getBankDetails,
  fundWallet,
  handlePaypalWebhook,
  uploadBankTransferReceipt,
} = require('../../controllers/wallet/walletFunding.controller');

const { protect: authMiddleware } = require('../../middlewares/authMiddleware');
const { requireRole } = require('../../middlewares/roleMiddleware');
const {
  validateFundingRequest,
  validateBankTransferUpload,
} = require('../../middlewares/wallet/walletValidation.middleware');
const uploadReceipt = require('../../middlewares/wallet/receiptUpload.middleware');

// ⚠️ wallet endpoints متاحة فقط لحسابات BRAND
const brandOnly = requireRole('BRAND');

// @route   GET /api/wallet
router.get('/', authMiddleware, brandOnly, getWallet);

// @route   GET /api/wallet/bank-details
router.get('/bank-details', authMiddleware, brandOnly, getBankDetails);

// @route   POST /api/wallet/fund
router.post('/fund', authMiddleware, brandOnly, validateFundingRequest, fundWallet);

// @route   POST /api/wallet/paypal/webhook
// ⚠️ بدون authMiddleware — PayPal بيستدعيه مباشرة بدون توكن مستخدم.
// ⚠️ لازم هالمسار بالذات يستخدم express.raw() بدل express.json() بـ app.js
// عشان processPaypalWebhook تقدر تتحقق من التوقيع على الـ body الخام (raw).
router.post('/paypal/webhook', handlePaypalWebhook);

// @route   POST /api/wallet/bank-transfer/upload
router.post(
  '/bank-transfer/upload',
  authMiddleware,
  brandOnly,
  uploadReceipt,
  validateBankTransferUpload,
  uploadBankTransferReceipt
);

module.exports = router;