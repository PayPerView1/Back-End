// src/routes/wallet/transactionHistory.routes.js
const express = require('express');
const router = express.Router();

const {
  listTransactions,
  getTransactionDetail,
  exportTransactions,
} = require('../../controllers/wallet/transactionHistory.controller');

const { protect: authMiddleware } = require('../../middlewares/authMiddleware');
const { requireRole } = require('../../middlewares/roleMiddleware');

const brandOnly = requireRole('BRAND');

// ⚠️ مهم: /export لازم تجي قبل /:id
// وإلا express رح يعامل "export" كأنه id ويفشل

// @route   GET /api/v1/wallet/transactions
router.get('/', authMiddleware, brandOnly, listTransactions);

// @route   GET /api/v1/wallet/transactions/export
router.get('/export', authMiddleware, brandOnly, exportTransactions);

// @route   GET /api/v1/wallet/transactions/:id
router.get('/:id', authMiddleware, brandOnly, getTransactionDetail);

module.exports = router;