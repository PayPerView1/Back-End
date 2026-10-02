// src/routes/wallet/transactionHistory.routes.js

const express = require('express');
const router  = express.Router();

const {
  getTransactions,
  exportTransactions,
  exportTransactionsPDF,  // ← جديد
  getTransactionById,
} = require('../../controllers/wallet/transactionHistory.controller');

const { protect } = require('../../middlewares/authMiddleware');

// GET /api/v1/wallet/transactions
router.get('/', protect, getTransactions);

// GET /api/v1/wallet/transactions/export
// ⚠️ قبل /:id
router.get('/export', protect, exportTransactions);

// GET /api/v1/wallet/transactions/export/pdf
// ⚠️ قبل /:id أيضاً
router.get('/export/pdf', protect, exportTransactionsPDF);

// GET /api/v1/wallet/transactions/:id
router.get('/:id', protect, getTransactionById);

module.exports = router;