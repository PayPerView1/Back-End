// src/routes/wallet/walletRefund.routes.js
//
// يُركَّب في app.js مرة واحدة فقط على:  app.use('/api/v1/wallet', walletRefundRoutes);
// ومساراته هنا كاملة (نسبة إلى /api/v1/wallet) وتطابق API_CONTRACT_Sprint3:
//   POST   /api/v1/wallet/refund
//   DELETE /api/v1/wallet/refund/:id
//   GET    /api/v1/wallet/refunds
// (مسار مراجعة الأدمن PUT /refund/:id انتقل إلى admin/walletAdmin.routes.js)
//
// ⚠️ لا تستعمل router.use(protect) هنا: الـ router مركَّب على /api/v1/wallet المشترك
//    مع walletFundingRoutes، فالـ middleware العام سيمسّ مسارات ليست له (مثل webhooks).

const express = require('express');
const router = express.Router();

const {
  submitRefundRequest,
  cancelRefundRequest,
  getRefundRequests,
} = require('../../controllers/wallet/walletRefund.controller');

const { protect } = require('../../middlewares/authMiddleware');
const { validateSubmitRefund } = require('../../validators/wallet/walletRefund.validator');

// ----------------------------------------
// POST /api/v1/wallet/refund
// ----------------------------------------
router.post('/refund', protect, validateSubmitRefund, submitRefundRequest);

// ----------------------------------------
// DELETE /api/v1/wallet/refund/:id
// ----------------------------------------
router.delete('/refund/:id', protect, cancelRefundRequest);

// ----------------------------------------
// GET /api/v1/wallet/refunds
// ⚠️ '/refunds/list' كان المسار الفعلي سابقاً (بينما العقد يقول /refunds).
//    أبقيناه كـ alias مؤقت حتى تتأكدوا أن الفرونت يستعمل /refunds، ثم احذفه.
// ----------------------------------------
router.get(['/refunds', '/refunds/list'], protect, getRefundRequests);

module.exports = router;