// src/routes/wallet/walletRefund.routes.js

const express = require('express');
const router = express.Router();

const {
  submitRefundRequest,
  cancelRefundRequest,
  getRefundRequests,
  reviewRefundRequest,
} = require('../../controllers/wallet/walletRefund.controller');

const { protect }    = require('../../middlewares/authMiddleware');
const adminOnly      = require('../../middlewares/adminOnly');
const { validateSubmitRefund, validateAdminRefundAction } = require('../../validators/wallet/walletRefund.validator');

// ----------------------------------------
// POST /api/v1/wallet/refund
// ----------------------------------------
router.post('/', protect, validateSubmitRefund, submitRefundRequest);

// ----------------------------------------
// DELETE /api/v1/wallet/refund/:id
// ----------------------------------------
router.delete('/:id', protect, cancelRefundRequest);

// ----------------------------------------
// GET /api/v1/wallet/refunds
// ⚠️ هذا الـ route يُسجَّل في app.js تحت
//    /api/v1/wallet/refunds وليس /api/v1/wallet/refund
// ----------------------------------------
router.get('/list', protect, getRefundRequests);

// ----------------------------------------
// PUT /api/v1/admin/wallet/refund/:id
// ⚠️ يُسجَّل في app.js تحت /api/v1/admin/wallet/refund
// ----------------------------------------
router.put('/:id', protect, adminOnly, validateAdminRefundAction, reviewRefundRequest);

module.exports = router;