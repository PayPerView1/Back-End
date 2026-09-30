// src/routes/wallet/transactionHistory.routes.js

const express = require('express');
const router = express.Router();

const {
  getTransactions,
  exportTransactions,
  getTransactionById,
} = require('../../controllers/wallet/transactionHistory.controller');

const { protect } = require('../../middlewares/authMiddleware');

// ----------------------------------------
// GET /api/v1/wallet/transactions
// ----------------------------------------
router.get('/', protect, getTransactions);

// ----------------------------------------
// GET /api/v1/wallet/transactions/export
// ⚠️ لازم تجي قبل /:id
// عشان Express ما يفسر "export" كـ :id
// ----------------------------------------
router.get('/export', protect, exportTransactions);

// ----------------------------------------
// GET /api/v1/wallet/transactions/:id
// ----------------------------------------
router.get('/:id', protect, getTransactionById);

module.exports = router;