// src/routes/wallet/walletFunding.routes.js

const express = require('express');
const router = express.Router();

const {
  getWallet,
  getBankDetails,
  initiateFunding,
  handlePaypalWebhook,
  uploadBankTransferReceipt,
  reviewBankTransfer,
} = require('../../controllers/wallet/walletFunding.controller');

const { protect }       = require('../../middlewares/authMiddleware');
const adminOnly         = require('../../middlewares/adminOnly');
const { validateFundingRequest, validateBankTransferUpload } = require('../../middlewares/wallet/walletValidation.middleware');
const uploadReceipt     = require('../../middlewares/wallet/receiptUpload.middleware');

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
// POST /api/v1/wallet/paypal/webhook
// ⚠️ بدون protect — PayPal يستدعيه مباشرة
// ⚠️ express.raw مضبوط على هذا الرابط في app.js
// ----------------------------------------
router.post('/paypal/webhook', handlePaypalWebhook);

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
// PUT /api/v1/admin/wallet/bank-transfer/:id
// ⚠️ هذا الـ route يُسجَّل في app.js تحت /api/v1/admin
//    وليس تحت /api/v1/wallet — راجع ملاحظة app.js أدناه
// ----------------------------------------
router.put('/bank-transfer/:id', protect, adminOnly, reviewBankTransfer);

module.exports = router;