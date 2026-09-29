// src/controllers/wallet/walletFunding.controller.js
const walletFundingService = require('../../services/wallet/walletFunding.service');

// ============================================
// GET /api/wallet
// ============================================
const getWallet = async (req, res) => {
  try {
    const wallet = await walletFundingService.getOrCreateWallet(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        id: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    console.error(`[walletFunding.controller] getWallet error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching wallet',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/wallet/bank-details
// ============================================
const getBankDetails = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      bankName: process.env.BANK_NAME,
      beneficiaryName: process.env.BANK_BENEFICIARY_NAME,
      iban: process.env.BANK_IBAN,
      swiftCode: process.env.BANK_SWIFT_CODE,
      currency: 'USD',
      note: 'Please include your registered email in the transfer description',
    },
  });
};

// ============================================
// POST /api/wallet/fund
// ============================================
const fundWallet = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    const result = await walletFundingService.initiateFunding(req.user._id, amount, paymentMethod);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(`[walletFunding.controller] fundWallet error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error while initiating funding',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/wallet/paypal/webhook
// ============================================
const handlePaypalWebhook = async (req, res) => {
  try {
    const result = await walletFundingService.processPaypalWebhook(req.headers, req.body);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[walletFunding.controller] handlePaypalWebhook error: ${error.message}`);

    if (error.code === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: error.message, code: 'FORBIDDEN' });
    }

    // أي خطأ تاني — نرجع 200 منعاً لإعادة المحاولة من PayPal
    res.status(200).json({ success: false, message: 'Webhook processed with errors, logged for review' });
  }
};

// ============================================
// POST /api/wallet/bank-transfer/upload
// ============================================
const uploadBankTransferReceipt = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const receiptUrl = req.file.path;

    const result = await walletFundingService.uploadBankTransferReceipt(
      transactionId,
      req.user._id,
      receiptUrl
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(`[walletFunding.controller] uploadBankTransferReceipt error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while uploading receipt',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/admin/wallet/bank-transfer/:id
// ============================================
const reviewBankTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body;

    if (action === 'APPROVE') {
      const result = await walletFundingService.approveBankTransfer(id, req.user._id);
      return res.status(200).json({ success: true, data: result });
    }

    if (action === 'REJECT') {
      const result = await walletFundingService.rejectBankTransfer(id, req.user._id, note);
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(400).json({
      success: false,
      message: 'action must be either APPROVE or REJECT',
      code: 'VALIDATION_ERROR',
    });
  } catch (error) {
    console.error(`[walletFunding.controller] reviewBankTransfer error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while reviewing bank transfer',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  getWallet,
  getBankDetails,
  fundWallet,
  handlePaypalWebhook,
  uploadBankTransferReceipt,
  reviewBankTransfer,
};