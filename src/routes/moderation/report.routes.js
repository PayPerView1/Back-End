// src/routes/moderation/report.routes.js
// المالك: الشخص A — الإبلاغ والإشراف (API_CONTRACT_Sprint4.md §5)
// ⚠️ بلا router.use عام (POST /campaigns/:campaignId/report مفتوح للزوار عبر optionalAuth).
// ترتيب: /reports/confirm و /reports/statistics قبل /reports/:id
const express = require('express');
const router = express.Router();

const { protect } = require('../../middlewares/authMiddleware');
const { optionalAuth } = require('../../middlewares/authMiddleware');
const adminOnly = require('../../middlewares/adminOnly');
const { reportRateLimiter } = require('../../middlewares/moderation/reportRateLimiter');
const reportController = require('../../controllers/moderation/report.controller');
const reportValidator = require('../../validators/moderation/report.validator');

// POST /api/v1/campaigns/:campaignId/report
router.post(
  '/campaigns/:campaignId/report',
  optionalAuth,
  reportRateLimiter,
  reportValidator.validateCampaignIdParam,
  reportValidator.validateSubmitReport,
  reportValidator.validate,
  reportController.submitReport
);

// POST /api/v1/reports/confirm
router.post(
  '/reports/confirm',
  reportValidator.validateConfirmReport,
  reportValidator.validate,
  reportController.confirmVisitorReport
);

// GET /api/v1/reports/statistics
router.get(
  '/reports/statistics',
  protect,
  adminOnly,
  reportController.getReportStatistics
);

// GET /api/v1/reports
router.get(
  '/reports',
  protect,
  adminOnly,
  reportValidator.validateListReports,
  reportValidator.validate,
  reportController.getReports
);

// GET /api/v1/reports/:id
router.get(
  '/reports/:id',
  protect,
  adminOnly,
  reportValidator.validateReportIdParam,
  reportValidator.validate,
  reportController.getReportById
);

// PUT /api/v1/reports/:id
router.put(
  '/reports/:id',
  protect,
  adminOnly,
  reportValidator.validateReportIdParam,
  reportValidator.validateReviewReport,
  reportValidator.validate,
  reportController.reviewReport
);

module.exports = router;