// src/middlewares/wallet/walletValidation.middleware.js

const mongoose = require('mongoose');
const {
  fundingSchema,
  captureSchema,
  reviewSchema,
} = require('../../validators/wallet/walletFunding.validator');

const JOI_OPTIONS = { abortEarly: false, stripUnknown: true };

const sendValidationError = (res, message, code = 'VALIDATION_ERROR') =>
  res.status(400).json({ success: false, message, code });

// ----------------------
// التحقق من صحة طلب الشحن
// ----------------------
const validateFundingRequest = (req, res, next) => {
  const { error, value } = fundingSchema.validate(req.body, JOI_OPTIONS);

  if (error) {
    // نعتمد على نوع الخطأ (d.type) وليس على نص الرسالة
    const types = error.details.map((d) => d.type);

    let code = 'VALIDATION_ERROR';
    if (types.includes('number.min')) code = 'AMOUNT_TOO_LOW';
    if (types.includes('number.max')) code = 'AMOUNT_TOO_HIGH';

    return sendValidationError(res, error.details[0].message, code);
  }

  // القيمة المحوّلة (مثلاً "50" → 50) وليس الأصلية
  req.body = value;
  next();
};

// ----------------------
// التحقق من طلب capture لـ PayPal
// ----------------------
const validateCapture = (req, res, next) => {
  const { error, value } = captureSchema.validate(req.body, JOI_OPTIONS);

  if (error) {
    return sendValidationError(res, error.details[0].message);
  }

  req.body = value;
  next();
};

// ----------------------
// التحقق من صحة رفع إيصال التحويل البنكي
// ----------------------
const validateBankTransferUpload = (req, res, next) => {
  if (!req.file) {
    return sendValidationError(res, 'Receipt file is required');
  }

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    return sendValidationError(res, 'Invalid file type. Allowed: jpg, png, pdf');
  }

  if (req.file.size > MAX_SIZE_BYTES) {
    return sendValidationError(res, 'File size exceeds 5MB limit');
  }

  const { transactionId } = req.body;
  if (!transactionId) {
    return sendValidationError(res, 'Transaction ID is required');
  }
  if (!mongoose.isValidObjectId(transactionId)) {
    return sendValidationError(res, 'Transaction ID is invalid');
  }

  next();
};

// ----------------------
// التحقق من طلب مراجعة التحويل البنكي (أدمن)
// ----------------------
const validateReview = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({
      success: false,
      message: 'Bank transfer not found',
      code: 'NOT_FOUND',
    });
  }

  const { error, value } = reviewSchema.validate(req.body, JOI_OPTIONS);

  if (error) {
    return sendValidationError(res, error.details[0].message);
  }

  req.body = value;
  next();
};

module.exports = {
  validateFundingRequest,
  validateCapture,
  validateBankTransferUpload,
  validateReview,
};