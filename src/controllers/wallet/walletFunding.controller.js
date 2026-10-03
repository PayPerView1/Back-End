// src/controllers/wallet/walletFunding.controller.js

const walletFundingService = require('../../services/wallet/walletFunding.service');;

const getStatusFromCode = (code) => {
  switch (code) {
    case 'NOT_FOUND':            return 404;
    case 'FORBIDDEN':            return 403;
    case 'INSUFFICIENT_BALANCE': return 400;
    case 'VALIDATION_ERROR':     return 400;
    case 'AMOUNT_TOO_LOW':       return 400;
    case 'AMOUNT_TOO_HIGH':      return 400;
    default:                     return 500;
  }
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
    console.error('[walletFunding.controller] getWallet error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// GET /api/v1/wallet/bank-details
// ============================================
const getBankDetails = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('[walletFunding.controller] getBankDetails error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      code:    'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/v1/wallet/fund
// ============================================
const initiateFunding = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body; // ← حذفنا sourceToken
    const result = await walletFundingService.initiateFunding(
      req.user._id,
      amount,
      paymentMethod
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('[walletFunding.controller] initiateFunding error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/v1/wallet/paypal/webhook
// ⚠️ بدون protect — PayPal يستدعيه مباشرة
// ⚠️ يستقبل raw body بسبب express.raw في app.js
// ============================================
const handlePaypalWebhook = async (req, res) => {
  try {
    await walletFundingService.processPaypalWebhook(req.headers, req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[walletFunding.controller] handlePaypalWebhook error:', error);
    if (error.code === 'FORBIDDEN') {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
        code:    'FORBIDDEN',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      code:    'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/v1/wallet/moyasar/webhook  ← جديد
// ⚠️ بدون protect — Moyasar يستدعيه مباشرة
// ⚠️ يستقبل raw body بسبب express.raw في app.js
// ============================================
const handleMoyasarWebhook = async (req, res) => {
  try {
    await walletFundingService.processMoyasarWebhook(req.headers, req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[walletFunding.controller] handleMoyasarWebhook error:', error);
    if (error.code === 'FORBIDDEN') {
      return res.status(400).json({
        success: false,
        message: 'Invalid Moyasar webhook signature',
        code:    'FORBIDDEN',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      code:    'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/v1/wallet/bank-transfer/upload
// ============================================
const uploadBankTransferReceipt = async (req, res) => {
  try {
    const receiptUrl      = req.file.path;
    const { transactionId } = req.body;
    const result = await walletFundingService.uploadBankTransferReceipt(
      transactionId,
      req.user._id,
      receiptUrl
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[walletFunding.controller] uploadBankTransferReceipt error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/admin/wallet/bank-transfer/:id
// ============================================
const reviewBankTransfer = async (req, res) => {
  try {
    const { action, note } = req.body;
    const { id }           = req.params;
    const result = action === 'APPROVE'
      ? await walletFundingService.approveBankTransfer(id, req.user._id)
      : await walletFundingService.rejectBankTransfer(id, req.user._id, note);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[walletFunding.controller] reviewBankTransfer error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  getWallet,
  getBankDetails,
  initiateFunding,
  handlePaypalWebhook,
  handleMoyasarWebhook,       // ← جديد
  uploadBankTransferReceipt,
  reviewBankTransfer,
};
// // src/controllers/wallet/walletFunding.controller.js

// const walletFundingService = require('../../services/wallet/walletFunding.service');
// const Wallet = require('../../models/wallet');

// // ----------------------
// // Helper: تحويل error.code لـ HTTP status
// // ----------------------
// const getStatusFromCode = (code) => {
//   switch (code) {
//     case 'NOT_FOUND':              return 404;
//     case 'FORBIDDEN':              return 403;
//     case 'INSUFFICIENT_BALANCE':   return 400;
//     case 'VALIDATION_ERROR':       return 400;
//     case 'AMOUNT_TOO_LOW':         return 400;
//     case 'AMOUNT_TOO_HIGH':        return 400;
//     default:                       return 500;
//   }
// };

// // ============================================
// // GET /api/v1/wallet
// // ============================================
// const getWallet = async (req, res) => {
//   try {
//     const wallet = await walletFundingService.getOrCreateWallet(req.user._id);

//     res.status(200).json({
//       success: true,
//       data: {
//         id: wallet._id,
//         balance: wallet.balance,
//         currency: wallet.currency,
//         updatedAt: wallet.updatedAt,
//       },
//     });
//   } catch (error) {
//     console.error('[walletFunding.controller] getWallet error:', error);
//     res.status(getStatusFromCode(error.code)).json({
//       success: false,
//       message: error.message || 'Server error',
//       code: error.code || 'INTERNAL_ERROR',
//     });
//   }
// };

// // ============================================
// // GET /api/v1/wallet/bank-details
// // ============================================
// const getBankDetails = async (req, res) => {
//   try {
//     res.status(200).json({
//       success: true,
//       data: {
//         bankName:        process.env.BANK_NAME,
//         beneficiaryName: process.env.BANK_BENEFICIARY_NAME,
//         iban:            process.env.BANK_IBAN,
//         swiftCode:       process.env.BANK_SWIFT_CODE,
//         currency:        'USD',
//         note:            'Please include your registered email in the transfer description',
//       },
//     });
//   } catch (error) {
//     console.error('[walletFunding.controller] getBankDetails error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       code: 'INTERNAL_ERROR',
//     });
//   }
// };

// // ============================================
// // POST /api/v1/wallet/fund
// // ============================================
// const initiateFunding = async (req, res) => {
//   try {
//     const { amount, paymentMethod } = req.body;

//     const result = await walletFundingService.initiateFunding(
//       req.user._id,
//       amount,
//       paymentMethod
//     );

//     res.status(201).json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error('[walletFunding.controller] initiateFunding error:', error);
//     res.status(getStatusFromCode(error.code)).json({
//       success: false,
//       message: error.message || 'Server error',
//       code: error.code || 'INTERNAL_ERROR',
//     });
//   }
// };

// // ============================================
// // POST /api/v1/wallet/paypal/webhook
// // ⚠️ لا يحتاج auth middleware — PayPal يستدعيه مباشرة
// // ⚠️ يستقبل raw body وليس JSON محلل
// // ============================================
// const handlePaypalWebhook = async (req, res) => {
//   try {
//     const result = await walletFundingService.processPaypalWebhook(
//       req.headers,
//       req.body // raw buffer بسبب express.raw في app.js
//     );

//     // دائماً نرجع 200 لـ PayPal حتى في حالة duplicate
//     res.status(200).json({ success: true });
//   } catch (error) {
//     console.error('[walletFunding.controller] handlePaypalWebhook error:', error);

//     // لو الـ signature غلط نرجع 400
//     if (error.code === 'FORBIDDEN') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid webhook signature',
//         code: 'FORBIDDEN',
//       });
//     }

//     // أي خطأ آخر نرجع 500 لكن PayPal سيعيد المحاولة
//     res.status(500).json({
//       success: false,
//       message: 'Webhook processing failed',
//       code: 'INTERNAL_ERROR',
//     });
//   }
// };

// // ============================================
// // POST /api/v1/wallet/bank-transfer/upload
// // ============================================
// const uploadBankTransferReceipt = async (req, res) => {
//   try {
//     // receiptUpload.middleware يضع الملف في req.file
//     // والـ URL جاهز من Cloudinary في req.file.path
//     const receiptUrl = req.file.path;
//     const { transactionId } = req.body;

//     const result = await walletFundingService.uploadBankTransferReceipt(
//       transactionId,
//       req.user._id,
//       receiptUrl
//     );

//     res.status(200).json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error('[walletFunding.controller] uploadBankTransferReceipt error:', error);
//     res.status(getStatusFromCode(error.code)).json({
//       success: false,
//       message: error.message || 'Server error',
//       code: error.code || 'INTERNAL_ERROR',
//     });
//   }
// };

// // ============================================
// // PUT /api/v1/admin/wallet/bank-transfer/:id
// // ============================================
// const reviewBankTransfer = async (req, res) => {
//   try {
//     const { action, note } = req.body;
//     const { id } = req.params;

//     let result;
//     if (action === 'APPROVE') {
//       result = await walletFundingService.approveBankTransfer(id, req.user._id);
//     } else {
//       result = await walletFundingService.rejectBankTransfer(id, req.user._id, note);
//     }

//     res.status(200).json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error('[walletFunding.controller] reviewBankTransfer error:', error);
//     res.status(getStatusFromCode(error.code)).json({
//       success: false,
//       message: error.message || 'Server error',
//       code: error.code || 'INTERNAL_ERROR',
//     });
//   }
// };

// module.exports = {
//   getWallet,
//   getBankDetails,
//   initiateFunding,
//   handlePaypalWebhook,
//   uploadBankTransferReceipt,
//   reviewBankTransfer,
// };