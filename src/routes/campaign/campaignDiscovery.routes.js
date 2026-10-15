// src/routes/campaign/campaignDiscovery.routes.js
// المالك: الشخص B — الاكتشاف والتفاصيل والتوصيات (API_CONTRACT_Sprint4.md §1, §2.1)
// ⚠️ قواعد هذا الملف:
//  - لا تستعمل router.use(protect, ...) عاماً؛ ضع الـ middleware على كل route على حدة
//    (هذا الـ router مُركَّب على /api/v1 قبل campaignBudgetRoutes).
//  - المسارات الثابتة أولاً: /campaigns/discover/suggestions ثم /campaigns/discover
//    ثم /campaigns/recommendations ثم /campaigns/:campaignId/details

// const express = require('express');
// const router = express.Router();

// TODO(B): GET /campaigns/discover/suggestions
// TODO(B): GET /campaigns/discover
// TODO(B): GET /campaigns/recommendations
// TODO(B): GET /campaigns/:campaignId/details

// module.exports = router;


// src/routes/campaign/campaignDiscovery.routes.js
// المالك: الشخص B — الاكتشاف والتفاصيل والتوصيات (API_CONTRACT_Sprint4.md §1, §2.1)
//
// ⚠️ قواعد هذا الملف:
//  - لا تستعمل router.use(protect, ...) عاماً؛ ضع الـ middleware على كل route على حدة
//    (هذا الـ router مُركَّب على /api/v1 قبل campaignBudgetRoutes).
//  - المسارات الثابتة أولاً: /campaigns/discover/suggestions ثم /campaigns/discover
//    ثم /campaigns/recommendations ثم /campaigns/:campaignId/details

const express = require('express');
const router = express.Router();

const campaignDiscoveryController = require('../../controllers/campaign/campaignDiscovery.controller');
const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const {
  discoverQuerySchema,
  suggestionsQuerySchema,
  recommendationsQuerySchema,
  campaignIdParamSchema,
} = require('../../validators/campaign/campaignDiscovery.validator');

// ─────────────────────────────────────────────
// Static paths first
// ─────────────────────────────────────────────

// GET /campaigns/discover/suggestions
router.get(
  '/campaigns/discover/suggestions',
  protect,
  requireClipperRole,
  validate({ query: suggestionsQuerySchema }),
  campaignDiscoveryController.suggestions
);

// GET /campaigns/discover
router.get(
  '/campaigns/discover',
  protect,
  requireClipperRole,
  validate({ query: discoverQuerySchema }),
  campaignDiscoveryController.discover
);

// GET /campaigns/recommendations
router.get(
  '/campaigns/recommendations',
  protect,
  requireClipperRole,
  validate({ query: recommendationsQuerySchema }),
  campaignDiscoveryController.recommendations
);

// ─────────────────────────────────────────────
// Parametric paths last
// ─────────────────────────────────────────────

// GET /campaigns/:campaignId/details
router.get(
  '/campaigns/:campaignId/details',
  protect,
  requireClipperRole,
  validate({ params: campaignIdParamSchema }),
  campaignDiscoveryController.getDetails
);

module.exports = router;