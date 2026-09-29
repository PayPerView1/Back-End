// src/controllers/wallet/transactionHistory.controller.js

const transactionHistoryService = require('../../services/wallet/transactionHistory.service');

// ============================================
// GET /api/v1/wallet/transactions
// ============================================
const listTransactions = async (req, res) => {
  try {
    // ⚠️ paymentMethod, dateFrom, dateTo, search يتم تجاهلهم بصمت (MVP)
    const { type, status, page, perPage } = req.query;

    const result = await transactionHistoryService.listTransactions(req.user._id, {
      type,
      status,
      page,
      perPage,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error(`[transactionHistory.controller] listTransactions error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching transactions',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/transactions/:id
// ============================================
const getTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await transactionHistoryService.getTransactionDetail(
      id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error(`[transactionHistory.controller] getTransactionDetail error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
        code: 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching transaction',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/transactions/export
// ============================================
const exportTransactions = async (req, res) => {
  try {
    const { type, status } = req.query;

    const { buffer, filename } = await transactionHistoryService.exportTransactions(
      req.user._id,
      { type, status }
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.status(200).send(buffer);
  } catch (error) {
    console.error(`[transactionHistory.controller] exportTransactions error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    res.status(500).json({
      success: false,
      message: 'Export failed',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  listTransactions,
  getTransactionDetail,
  exportTransactions,
};