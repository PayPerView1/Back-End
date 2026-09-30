// src/controllers/wallet/transactionHistory.controller.js

const transactionHistoryService = require('../../services/wallet/transactionHistory.service');
const Wallet = require('../../models/wallet');

// ----------------------
// Helper: تحويل error.code لـ HTTP status
// ----------------------
const getStatusFromCode = (code) => {
  switch (code) {
    case 'NOT_FOUND':  return 404;
    case 'FORBIDDEN':  return 403;
    default:           return 500;
  }
};

// ----------------------
// Helper: جلب محفظة المعلن
// ----------------------
const getAdvertiserWallet = async (advertiserId) => {
  const wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) {
    const error = new Error('Wallet not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return wallet;
};

// ============================================
// GET /api/v1/wallet/transactions
// ============================================
const getTransactions = async (req, res) => {
  try {
    const wallet = await getAdvertiserWallet(req.user._id);

    // الفلاتر المفعّلة في MVP: type + status
    // الباقي (paymentMethod, dateFrom, dateTo, search) يُقبل ويُتجاهل صامتاً
    const filters = {
      type:   req.query.type,
      status: req.query.status,
    };

    const pagination = {
      page:    req.query.page,
      perPage: req.query.perPage,
    };

    const result = await transactionHistoryService.getTransactions(
      wallet._id,
      filters,
      pagination
    );

    res.status(200).json({
      success: true,
      data:       result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('[transactionHistory.controller] getTransactions error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/transactions/export
// ⚠️ يجب أن يكون قبل /:id في الـ router
// ============================================
const exportTransactions = async (req, res) => {
  try {
    const wallet = await getAdvertiserWallet(req.user._id);

    const filters = {
      type:   req.query.type,
      status: req.query.status,
    };

    const buffer = await transactionHistoryService.exportTransactionsExcel(
      wallet._id,
      filters
    );

    const filename = `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    res.status(200).send(buffer);
  } catch (error) {
    console.error('[transactionHistory.controller] exportTransactions error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Export failed',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/transactions/:id
// ============================================
const getTransactionById = async (req, res) => {
  try {
    const wallet = await getAdvertiserWallet(req.user._id);

    const transaction = await transactionHistoryService.getTransactionById(
      req.params.id,
      wallet._id
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
        code:    'NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('[transactionHistory.controller] getTransactionById error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  getTransactions,
  exportTransactions,
  getTransactionById,
};