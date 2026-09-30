// src/middlewares/wallet/walletValidation.middleware.js

const { fundingSchema } = require('../../validators/wallet/walletFunding.validator');

// ----------------------
// التحقق من صحة طلب الشحن
// ----------------------
const validateFundingRequest = (req, res, next) => {
  const { error } = fundingSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const messages = error.details.map((d) => d.message);

    // تحديد الـ code المناسب بناءً على نوع الخطأ
    let code = 'VALIDATION_ERROR';
    if (messages.some((m) => m.includes('Minimum'))) code = 'AMOUNT_TOO_LOW';
    if (messages.some((m) => m.includes('Maximum'))) code = 'AMOUNT_TOO_HIGH';

    return res.status(400).json({
      success: false,
      message: messages[0],
      code,
    });
  }

  next();
};

// ----------------------
// التحقق من صحة رفع إيصال التحويل البنكي
// ----------------------
const validateBankTransferUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Receipt file is required',
      code: 'VALIDATION_ERROR',
    });
  }

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Allowed: jpg, png, pdf',
      code: 'VALIDATION_ERROR',
    });
  }

  if (req.file.size > MAX_SIZE_BYTES) {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds 5MB limit',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!req.body.transactionId) {
    return res.status(400).json({
      success: false,
      message: 'Transaction ID is required',
      code: 'VALIDATION_ERROR',
    });
  }

  next();
};

module.exports = {
  validateFundingRequest,
  validateBankTransferUpload,
};