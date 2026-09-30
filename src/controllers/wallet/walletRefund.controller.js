// src/controllers/wallet/walletRefund.controller.js

const walletRefundService = require('../../services/wallet/walletRefund.service');
const Wallet = require('../../models/wallet');

// ----------------------
// Helper: تحويل error.code لـ HTTP status
// ----------------------
const getStatusFromCode = (code) => {
  switch (code) {
    case 'NOT_FOUND':              return 404;
    case 'FORBIDDEN':              return 403;
    case 'AMOUNT_TOO_LOW':         return 400;
    case 'INSUFFICIENT_BALANCE':   return 400;
    case 'ACTIVE_CAMPAIGN_EXISTS': return 400;
    case 'VALIDATION_ERROR':       return 400;
    case 'REFUND_NOT_CANCELLABLE': return 409;
    default:                       return 500;
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
// POST /api/v1/wallet/refund
// ============================================
const submitRefundRequest = async (req, res) => {
  try {
    const { amount } = req.body;

    const result = await walletRefundService.submitRefundRequest(
      req.user._id,
      amount
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[walletRefund.controller] submitRefundRequest error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// DELETE /api/v1/wallet/refund/:id
// ============================================
const cancelRefundRequest = async (req, res) => {
  try {
    const result = await walletRefundService.cancelRefundRequest(
      req.params.id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[walletRefund.controller] cancelRefundRequest error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/refunds
// ============================================
const getRefundRequests = async (req, res) => {
  try {
    const wallet = await getAdvertiserWallet(req.user._id);

    const pagination = {
      page:    req.query.page,
      perPage: req.query.perPage,
    };

    const result = await walletRefundService.getRefundRequests(
      wallet._id,
      pagination
    );

    res.status(200).json({
      success:    true,
      data:       result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('[walletRefund.controller] getRefundRequests error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/admin/wallet/refund/:id
// ============================================
const reviewRefundRequest = async (req, res) => {
  try {
    const { action, note } = req.body;
    const { id } = req.params;

    let result;
    if (action === 'APPROVE') {
      result = await walletRefundService.approveRefund(id, req.user._id, note);
    } else {
      result = await walletRefundService.rejectRefund(id, req.user._id, note);
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[walletRefund.controller] reviewRefundRequest error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  submitRefundRequest,
  cancelRefundRequest,
  getRefundRequests,
  reviewRefundRequest,
};