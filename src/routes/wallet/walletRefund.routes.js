// src/routes/wallet/walletRefund.routes.js
const express = require('express');
const router = express.Router();

const {
  submitRefund,
  cancelRefund,
  listRefunds,
} = require('../../controllers/wallet/walletRefund.controller');

const { protect: authMiddleware } = require('../../middlewares/authMiddleware');
const { requireRole } = require('../../middlewares/roleMiddleware');

const brandOnly = requireRole('BRAND');

// @route   POST /api/v1/wallet/refund
router.post('/refund', authMiddleware, brandOnly, submitRefund);

// @route   DELETE /api/v1/wallet/refund/:id
router.delete('/refund/:id', authMiddleware, brandOnly, cancelRefund);

// @route   GET /api/v1/wallet/refunds
router.get('/refunds', authMiddleware, brandOnly, listRefunds);

module.exports = router;