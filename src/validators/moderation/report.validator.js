// src/validators/moderation/report.validator.js
// قواعد express-validator لكل endpoints البلاغات (API_CONTRACT_Sprint4.md §5)،
// بنفس أسلوب notification.validator.js: مصفوفات قواعد + validate منفصلة.
//
// الاستعمال في report.routes.js:
//   router.post('/campaigns/:campaignId/report',
//     optionalAuth, reportRateLimiter,
//     validateCampaignIdParam, validateSubmitReport, validate,
//     submitReport);
//
// ملاحظات:
//  - الإلزامية "بدون JWT يجب email" تُفرض في report.service (الـ validator لا يعرف إن كان الطلب مسجّلاً).
//  - قيمة status الافتراضية (PENDING) في قائمة الأدمن تُطبَّق في الخدمة: status = filters.status || 'PENDING'.
//  - تعامل الخدمة مع page/perPage كنصوص (parsePagination يفعل ذلك)، فلا يهم إن لم تعدّل
//    المُحوِّلات (toInt) قيمة req.query في إصدارات Express الأحدث.
const { body, param, query, validationResult } = require('express-validator');
const { REPORT_REASON, REPORT_STATUS, REPORT_ACTION_TAKEN } = require('../../constants/discovery.constants');

// قرارات الأدمن في PUT /reports/:id
const REPORT_REVIEW_ACTION = {
  CONFIRM_VIOLATION: 'CONFIRM_VIOLATION',
  DISMISS: 'DISMISS',
};

const REASONS = Object.values(REPORT_REASON);

// ─────────────────────────────────────────────
// فاحص النتيجة الموحّد — بنفس شكل أخطاء العقد:
// { success, message, code: 'VALIDATION_ERROR', errors: [{ field, message }] }
// ─────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const list = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return res.status(400).json({
      success: false,
      message: list[0].message,
      code: 'VALIDATION_ERROR',
      errors: list,
    });
  }

  next();
};

// ─────────────────────────────────────────────
// params
// ─────────────────────────────────────────────
// POST /campaigns/:campaignId/report
const validateCampaignIdParam = [
  param('campaignId').isMongoId().withMessage('Invalid campaign ID format'),
];

// GET /reports/:id  و  PUT /reports/:id
const validateReportIdParam = [
  param('id').isMongoId().withMessage('Invalid report ID format'),
];

// ─────────────────────────────────────────────
// POST /campaigns/:campaignId/report
// ─────────────────────────────────────────────
const validateSubmitReport = [
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .bail()
    .isIn(REASONS)
    .withMessage(`Reason must be one of: ${REASONS.join(', ')}`),

  // details إلزامي عند OTHER
  body('details').custom((value, { req }) => {
    if (req.body.reason === REPORT_REASON.OTHER && !(value && String(value).trim())) {
      throw new Error('Details are required when the reason is OTHER');
    }
    return true;
  }),

  // وفي كل الحالات حتى 1000 حرف
  body('details')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Details cannot exceed 1000 characters'),

  // للزائر فقط (الإلزامية في الخدمة). toLowerCase وليس normalizeEmail
  // لأن الأخيرة تحذف نقاط Gmail فتغيّر العنوان الذي سنرسل إليه.
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .bail()
    .isLength({ max: 254 })
    .withMessage('Email is too long')
    .toLowerCase(),
];

// ─────────────────────────────────────────────
// POST /reports/confirm  (توكن رابط التأكيد: 32 byte = 64 hex)
// ─────────────────────────────────────────────
const validateConfirmReport = [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .bail()
    .isHexadecimal()
    .withMessage('Invalid token')
    .bail()
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid token'),
];

// ─────────────────────────────────────────────
// GET /reports  (الأدمن)
// ─────────────────────────────────────────────
const validateListReports = [
  query('status')
    .optional()
    .isIn([...Object.values(REPORT_STATUS), 'ALL'])
    .withMessage(`Status must be one of: ${[...Object.values(REPORT_STATUS), 'ALL'].join(', ')}`),

  query('reason')
    .optional()
    .isIn(REASONS)
    .withMessage(`Reason must be one of: ${REASONS.join(', ')}`),

  query('campaignId').optional().isMongoId().withMessage('Invalid campaign ID format'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('perPage')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('perPage must be between 1 and 50')
    .toInt(),
];

// ─────────────────────────────────────────────
// PUT /reports/:id  (الأدمن)
// ─────────────────────────────────────────────
const validateReviewReport = [
  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .bail()
    .isIn(Object.values(REPORT_REVIEW_ACTION))
    .withMessage('Action must be CONFIRM_VIOLATION or DISMISS'),

  // note إلزامي عند تأكيد المخالفة (يُرسَل للمعلن كسبب الإلغاء)
  body('note').custom((value, { req }) => {
    if (
      req.body.action === REPORT_REVIEW_ACTION.CONFIRM_VIOLATION &&
      !(value && String(value).trim())
    ) {
      throw new Error('A note is required when confirming a violation');
    }
    return true;
  }),

  body('note')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note cannot exceed 1000 characters'),
];

module.exports = {
  REPORT_REVIEW_ACTION,
  REPORT_STATUS,
  REPORT_ACTION_TAKEN,
  validate,
  validateCampaignIdParam,
  validateReportIdParam,
  validateSubmitReport,
  validateConfirmReport,
  validateListReports,
  validateReviewReport,
};