// src/controllers/wallet/walletFunding.controller.js

const walletFundingService = require('../../services/wallet/walletFunding.service');

// ----------------------
// Helper: تحويل error.code لـ HTTP status
// ----------------------
const getStatusFromCode = (code) => {
  switch (code) {
    case 'NOT_FOUND':            return 404;
    case 'FORBIDDEN':            return 403;
    case 'CONFLICT':             return 409;
    case 'INSUFFICIENT_BALANCE': return 400;
    case 'VALIDATION_ERROR':     return 400;
    case 'AMOUNT_TOO_LOW':       return 400;
    case 'AMOUNT_TOO_HIGH':      return 400;
    default:                     return 500;
  }
};

// ----------------------
// Helper: رد موحّد للأخطاء
// أخطاء 500 لا نكشف رسالتها الداخلية للعميل (مثل CastError أو أخطاء DB)
// ----------------------
const sendError = (res, error, context) => {
  console.error(`[walletFunding.controller] ${context} error:`, error);
  const status = getStatusFromCode(error.code);
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Server error' : error.message,
    code:    error.code || 'INTERNAL_ERROR',
  });
};

// ============================================
// GET /api/v1/wallet
// ============================================
const getWallet = async (req, res) => {
  try {
    const wallet = await walletFundingService.getOrCreateWallet(req.user._id);
    res.status(200).json({
      success: true,
      data: {
        id:        wallet._id,
        balance:   wallet.balance,
        currency:  wallet.currency,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    sendError(res, error, 'getWallet');
  }
};

// ============================================
// GET /api/v1/wallet/bank-details
// ============================================
const getBankDetails = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      bankName:        process.env.BANK_NAME,
      beneficiaryName: process.env.BANK_BENEFICIARY_NAME,
      iban:            process.env.BANK_IBAN,
      swiftCode:       process.env.BANK_SWIFT_CODE,
      currency:        'USD',
      note:            'Please include your registered email in the transfer description',
    },
  });
};

// ============================================
// POST /api/v1/wallet/fund
// ============================================
const initiateFunding = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const result = await walletFundingService.initiateFunding(
      req.user._id,
      amount,
      paymentMethod
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    sendError(res, error, 'initiateFunding');
  }
};

// ============================================
// POST /api/v1/wallet/paypal/capture
// يُستدعى من الفرونت عند وصول المستخدم لصفحة النجاح، body: { orderId }
// (orderId = قيمة ?token= التي يضيفها PayPal في return_url)
// ============================================
const capturePaypalOrder = async (req, res) => {
  try {
    const result = await walletFundingService.capturePaypalOrder(
      req.body.orderId,
      req.user._id
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    sendError(res, error, 'capturePaypalOrder');
  }
};

// ============================================
// Webhook handler factory (PayPal / Moyasar)
// ⚠️ بدون protect — البوابة تستدعيه مباشرة
// ⚠️ يتطلب raw body (express.raw في app.js) قبل express.json
//
// سياسة الردود:
//   - توقيع/توكن غير صالح  → 400
//   - NOT_FOUND / VALIDATION_ERROR → نسجّل ونرد 200 (إعادة المحاولة لن تنفع)
//   - أي خطأ آخر (DB مثلاً)  → 500 ليعيد المحاولة
// ============================================
const createWebhookHandler = (label, process) => async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body)) {
      console.error(
        `[walletFunding.controller] ${label}: body is not a raw Buffer — تأكد من express.raw على هذا المسار في app.js`
      );
      return res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        code:    'INTERNAL_ERROR',
      });
    }

    await process(req);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[walletFunding.controller] ${label} error:`, error);

    if (error.code === 'FORBIDDEN') {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
        code:    'FORBIDDEN',
      });
    }

    if (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR') {
      return res.status(200).json({ success: true, ignored: true });
    }

    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      code:    'INTERNAL_ERROR',
    });
  }
};

// POST /api/v1/wallet/paypal/webhook
const handlePaypalWebhook = createWebhookHandler(
  'handlePaypalWebhook',
  (req) => walletFundingService.processPaypalWebhook(req.headers, req.body)
);

// POST /api/v1/wallet/moyasar/webhook
const handleMoyasarWebhook = createWebhookHandler(
  'handleMoyasarWebhook',
  (req) => walletFundingService.processMoyasarWebhook(req.body)
);

// ============================================
// POST /api/v1/wallet/bank-transfer/upload
// ============================================
const uploadBankTransferReceipt = async (req, res) => {
  try {
    if (!req.file?.path) {
      const error = new Error('Receipt file is required');
      error.code  = 'VALIDATION_ERROR';
      throw error;
    }

    const result = await walletFundingService.uploadBankTransferReceipt(
      req.body.transactionId,
      req.user._id,
      req.file.path
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    sendError(res, error, 'uploadBankTransferReceipt');
  }
};

// ============================================
// PUT /api/v1/admin/wallet/bank-transfer/:id
// body: { action: 'APPROVE' | 'REJECT', note? }
// التحقق من action و note يتم في validateReview
// ============================================
const reviewBankTransfer = async (req, res) => {
  try {
    const { action, note } = req.body;
    const { id }           = req.params;

    let result;
    if (action === 'APPROVE') {
      result = await walletFundingService.approveBankTransfer(id, req.user._id);
    } else if (action === 'REJECT') {
      result = await walletFundingService.rejectBankTransfer(id, req.user._id, note);
    } else {
      const error = new Error('action must be APPROVE or REJECT');
      error.code  = 'VALIDATION_ERROR';
      throw error;
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    sendError(res, error, 'reviewBankTransfer');
  }
};

module.exports = {
  getWallet,
  getBankDetails,
  initiateFunding,
  capturePaypalOrder,
  handlePaypalWebhook,
  handleMoyasarWebhook,
  uploadBankTransferReceipt,
  reviewBankTransfer,
};