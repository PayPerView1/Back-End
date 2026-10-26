// src/utils/errors.js
// ملف مشترك لأخطاء سبرنت 4 — يستعمله كل الـ controllers الجديدة.
// الخدمات القديمة (مثل campaignBudget.service) ترمي Error عادي مع error.code،
// وsendError يدعم الشكلين (AppError و Error + code).

const STATUS_BY_CODE = {
  // عام (من عقد سبرنت 3)
  VALIDATION_ERROR: 400,
  AMOUNT_TOO_LOW: 400,
  AMOUNT_TOO_HIGH: 400,
  INSUFFICIENT_BALANCE: 400,
  ACTIVE_CAMPAIGN_EXISTS: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  REFUND_NOT_CANCELLABLE: 409,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,

  // سبرنت 4 — اكتشاف الحملات والتقديم
  CAMPAIGN_UNAVAILABLE: 409,
  CAMPAIGN_SUSPENDED: 409,
  ALREADY_APPLIED: 409,
  APPLICANT_LIMIT_REACHED: 409,
  REQUIREMENTS_NOT_MET: 403,
  APPLICATION_NOT_WITHDRAWABLE: 409,
  APPLICATION_ALREADY_REVIEWED: 409,

  // سبرنت 4 — الإبلاغ
  ALREADY_REPORTED: 409,
  CANNOT_REPORT_OWN_CAMPAIGN: 403,
  REPORT_ALREADY_REVIEWED: 409,
  INVALID_TOKEN: 400,
  TOO_MANY_REQUESTS: 429,
    // سبرنت 5 — التسليم والتنزيل
  INVALID_LINK: 400,
  UNSUPPORTED_PLATFORM: 400,
  PLATFORM_MISMATCH: 400,
  POST_NOT_PUBLIC: 422,
  CONTENT_REQUIREMENTS_NOT_MET: 422,
  LINK_ALREADY_SUBMITTED: 409,
  SUBMISSION_LIMIT_REACHED: 409,
  SUBMISSION_NOT_WITHDRAWABLE: 409,
  SUBMISSION_NOT_EDITABLE: 409,
  SUBMISSION_ALREADY_REVIEWED: 409,
  DOWNLOAD_LINK_EXPIRED: 410,
  APPLICATION_NOT_ACCEPTED: 403,
};

class AppError extends Error {
  /**
   * @param {string} message  رسالة مقروءة للمستخدم
   * @param {string} code     كود من STATUS_BY_CODE
   * @param {number} [statusCode] اختياري لتجاوز الافتراضي
   * @param {Object} [details]    بيانات إضافية تُرجَع للفرونت في الحقل details
   */
  constructor(message, code = 'INTERNAL_ERROR', statusCode, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode || STATUS_BY_CODE[code] || 500;
    this.details = details;
  }
}

const getStatusFromCode = (code) => STATUS_BY_CODE[code] || 500;

/**
 * يرسل استجابة خطأ بنفس شكل عقد سبرنت 3:
 * { success: false, message, code }
 * أخطاء 500 تُسجَّل في الـ log وتُرجع رسالة عامة "Server error".
 */
const sendError = (res, error, context = 'controller') => {
  let code = error.code;
  let message = error.message;
  let status = error.statusCode;

  // 1. معالجة أخطاء قاعدة البيانات (Mongo) والـ Validation
  if (error.code === 11000) {
    code = 'CONFLICT';
    message = 'Duplicate record';
    status = 409;
  } else if (error.name === 'ValidationError' && error.errors) {
    code = 'VALIDATION_ERROR';
    message =
      Object.values(error.errors)
        .map((e) => e.message)
        .join(', ') || 'Validation failed';
    status = 400;
  } else if (error.name === 'CastError') {
    code = 'VALIDATION_ERROR';
    message = 'Invalid identifier format';
    status = 400;
  }

  status = status || STATUS_BY_CODE[code] || 500;

  // 2. الحماية الخاصة بك (تسجيل الخطأ وإخفاء الرسالة الحقيقية للـ 500)
  if (status >= 500) {
    console.error(`[${context}] error:`, error);
    message = 'Server error'; // إخفاء الرسالة الحقيقية
    code = 'INTERNAL_ERROR';  // توحيد الكود
  }

  // 3. بناء الاستجابة النهائية (مرة واحدة لكل الأخطاء بفضل كود الـ AI)
  const body = {
    success: false,
    message: message,
    code: typeof code === 'string' ? code : 'INTERNAL_ERROR', // تصحيح القيمة الافتراضية
  };
  
  if (error.details) {
    body.details = error.details;
  }

  return res.status(status).json(body);
};

module.exports = { AppError, STATUS_BY_CODE, getStatusFromCode, sendError };