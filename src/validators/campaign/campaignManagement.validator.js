// src/validators/campaign/campaignManagement.validator.js
const { query, body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const {
  CAMPAIGN_STATUS,
  CONTENT_TYPE,
} = require('../../constants/campaign.constants');

// ─────────────────────────────────────────────
// القيم المسموحة — مستخرجة من الـ constants
// ─────────────────────────────────────────────

// كل حالات الحملة + ALL للفلترة
const VALID_STATUSES = [...Object.values(CAMPAIGN_STATUS), 'ALL'];

// كل أنواع المحتوى للفلترة
const VALID_CATEGORIES = Object.values(CONTENT_TYPE);

// الحقول المسموح بالترتيب حسبها — يجب أن تتطابق مع ALLOWED_SORT_FIELDS في pagination.utils.js
const VALID_SORT_FIELDS = ['createdAt', 'name', 'totalBudget'];

// اتجاهات الترتيب
const VALID_SORT_ORDERS = ['asc', 'desc'];

// ─────────────────────────────────────────────
// Middleware موحد لفحص نتائج التحقق
// نفس الـ pattern المستخدم في profileValidator.js
// ─────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
};

// ─────────────────────────────────────────────
// 1. validateGetCampaigns
// يُستخدم في: GET /api/v1/campaigns
// كل الحقول query parameters — اختيارية
// ─────────────────────────────────────────────
const validateGetCampaigns = [
  query('status')
    .optional()
    .trim()
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),

  query('category')
    .optional()
    .trim()
    .isIn(VALID_CATEGORIES)
    .withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('dateFrom must be a valid date (format: YYYY-MM-DD)')
    .toDate(),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('dateTo must be a valid date (format: YYYY-MM-DD)')
    .toDate()
    .custom((dateTo, { req }) => {
      // إذا أُرسل كلا التاريخين، يجب أن يكون dateFrom قبل dateTo
      if (req.query.dateFrom && dateTo) {
        const from = new Date(req.query.dateFrom);
        if (from > dateTo) {
          throw new Error('dateFrom must be before dateTo');
        }
      }
      return true;
    }),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('sortBy')
    .optional()
    .trim()
    .isIn(VALID_SORT_FIELDS)
    .withMessage(`sortBy must be one of: ${VALID_SORT_FIELDS.join(', ')}`),

  query('sortOrder')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(VALID_SORT_ORDERS)
    .withMessage('sortOrder must be either "asc" or "desc"'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),

  query('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be true or false')
    .toBoolean(),
];

// ─────────────────────────────────────────────
// 2. validateCampaignId
// يُستخدم في: كل endpoint يحتوي على :campaignId
// GET /:id, POST /:id/copy, PATCH /:id/archive ...إلخ
// ─────────────────────────────────────────────
const validateCampaignId = [
  param('campaignId')
    .trim()
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid campaign ID format');
      }
      return true;
    }),
];

// ─────────────────────────────────────────────
// 3. validateCopyCampaign
// يُستخدم في: POST /api/v1/campaigns/:campaignId/copy
// ─────────────────────────────────────────────
const validateCopyCampaign = [
  body('newName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Campaign name must be between 1 and 255 characters'),

  body('includeMaterials')
    .optional()
    .isBoolean()
    .withMessage('includeMaterials must be true or false')
    .toBoolean(),
];

// ─────────────────────────────────────────────
// 4. validateBulkAction
// يُستخدم في: POST /bulk-delete و POST /bulk-archive
// ─────────────────────────────────────────────
const validateBulkAction = [
  body('campaignIds')
    .exists()
    .withMessage('campaignIds is required')
    .isArray({ min: 1 })
    .withMessage('campaignIds must be a non-empty array')
    .custom((ids) => {
      // التحقق من أن كل عنصر هو MongoDB ObjectId صالح
      const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));

      if (invalidIds.length > 0) {
        throw new Error(
          `The following IDs are invalid: ${invalidIds.join(', ')}`
        );
      }

      // منع التكرار في الـ IDs
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        throw new Error('campaignIds must not contain duplicate values');
      }

      return true;
    }),
];

module.exports = {
  validateGetCampaigns,
  validateCampaignId,
  validateCopyCampaign,
  validateBulkAction,
  validate,
};