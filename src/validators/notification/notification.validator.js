//  src/validators/notification/notification.validator.js
const { query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Unified validation result checker
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
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
// 1. validateListNotifications
// Used in: GET /api/v1/notifications
// ─────────────────────────────────────────────
const validateListNotifications = [
  query('unread')
    .optional()
    .isBoolean()
    .withMessage('unread must be true or false')
    .toBoolean(),

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
// 2. validateNotificationId
// Used in: PATCH /api/v1/notifications/:id/read
// ─────────────────────────────────────────────
const validateNotificationId = [
  param('id')
    .trim()
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid notification ID format');
      }
      return true;
    }),
];

module.exports = {
  validateListNotifications,
  validateNotificationId,
  validate,
};