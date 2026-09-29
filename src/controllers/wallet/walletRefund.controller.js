// src/controllers/wallet/walletRefund.controller.js

const walletRefundService = require('../../services/wallet/walletRefund.service');

// ============================================
// POST /api/v1/wallet/refund
// ============================================
const submitRefund = async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await walletRefundService.submitRefundRequest(req.user._id, amount);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error(`[walletRefund.controller] submitRefund error: ${error.message}`);

    const errorMap = {
      AMOUNT_TOO_LOW: 400,
      INSUFFICIENT_BALANCE: 400,
      ACTIVE_CAMPAIGN_EXISTS: 400,
      NOT_FOUND: 404,
    };

    if (errorMap[error.code]) {
      return res.status(errorMap[error.code]).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while submitting refund',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// DELETE /api/v1/wallet/refund/:id
// ============================================
const cancelRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await walletRefundService.cancelRefundRequest(id, req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[walletRefund.controller] cancelRefund error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'REFUND_NOT_CANCELLABLE') {
      return res.status(409).json({ success: false, message: error.message, code: 'REFUND_NOT_CANCELLABLE' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while cancelling refund',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/refunds
// ============================================
const listRefunds = async (req, res) => {
  try {
    const { page, perPage } = req.query;
    const result = await walletRefundService.getRefundRequests(req.user._id, { page, perPage });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error(`[walletRefund.controller] listRefunds error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching refunds',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/admin/wallet/refund/:id
// ============================================
const reviewRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body;

    if (action === 'APPROVE') {
      const result = await walletRefundService.approveRefund(id, req.user._id, note);
      return res.status(200).json({ success: true, data: result });
    }

    if (action === 'REJECT') {
      if (!note) {
        return res.status(400).json({
          success: false,
          message: 'Rejection note is required',
          code: 'VALIDATION_ERROR',
        });
      }
      const result = await walletRefundService.rejectRefund(id, req.user._id, note);
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(400).json({
      success: false,
      message: 'action must be either APPROVE or REJECT',
      code: 'VALIDATION_ERROR',
    });
  } catch (error) {
    console.error(`[walletRefund.controller] reviewRefund error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'REFUND_NOT_CANCELLABLE') {
      return res.status(409).json({ success: false, message: error.message, code: 'REFUND_NOT_CANCELLABLE' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while reviewing refund',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  submitRefund,
  cancelRefund,
  listRefunds,
  reviewRefund,
};