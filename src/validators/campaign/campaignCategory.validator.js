// src/validators/campaign/campaignCategory.validator.js
const { query, validationResult } = require('express-validator');
const { CONTENT_TYPE } = require('../../constants/campaign.constants');

// ─────────────────────────────────────────────
// القيم المسموحة
// ─────────────────────────────────────────────
const VALID_CATEGORIES = Object.values(CONTENT_TYPE);

// ─────────────────────────────────────────────
// Middleware موحد — نفس الـ pattern
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
// 1. validateCategoryFilter
// يُستخدم في: GET /api/v1/campaigns?category=
// يتحقق فقط من أن قيمة category صحيحة إذا أُرسلت
// ─────────────────────────────────────────────
const validateCategoryFilter = [
  query('category')
    .optional()
    .trim()
    .isIn(VALID_CATEGORIES)
    .withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),
];

module.exports = {
  validateCategoryFilter,
  validate,
};