// src/routes/application/application.routes.js
// المالك: الشخص B — التقديم (API_CONTRACT_Sprint4.md §4)
// ⚠️ بلا router.use عام. المسارات الثابتة أولاً (/applications/my قبل /applications/:id).

// const express = require('express');
// const router = express.Router();

// TODO(B): POST   /campaigns/:campaignId/apply                (CLIPPER)
// TODO(B): GET    /campaigns/:campaignId/applications         (BRAND + verifyCampaignOwnership)
// TODO(B): GET    /applications/my                            (CLIPPER)
// TODO(B): GET    /applications/:id/materials                 (CLIPPER)
// TODO(B): PUT    /applications/:id/status                    (BRAND)
// TODO(B): DELETE /applications/:id                           (CLIPPER)


// module.exports = router;



// src/routes/application/application.routes.js
//
// ⚠️ هذا الملف مقسوم بين شخصين:
//    - Creator side (owner: B) — القسم العلوي
//    - Advertiser side (owner: A) — القسم السفلي
// كل شخص يعدّل قسمه فقط.
//
// ⚠️ هذا الـ router مُركَّب على /api/v1 (مساراته كاملة).
//    لا تستعملي router.use(protect, ...) عاماً، والـ middleware على كل route.

const express = require('express');
const router = express.Router();

const applicationController = require('../../controllers/application/application.controller');
const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const {
  campaignIdParamSchema,
  applicationIdParamSchema,
  applyBodySchema,
  myApplicationsQuerySchema,
} = require('../../validators/application/application.validator');

// ─────────────────────────────────────────────
// ── Creator side (owner: B) ──
// ─────────────────────────────────────────────

// GET /applications/my
router.get(
  '/applications/my',
  protect,
  requireClipperRole,
  validate({ query: myApplicationsQuerySchema }),
  applicationController.myApplications
);

// POST /campaigns/:campaignId/apply
router.post(
  '/campaigns/:campaignId/apply',
  protect,
  requireClipperRole,
  validate({ params: campaignIdParamSchema, body: applyBodySchema }),
  applicationController.apply
);

// GET /applications/:id/materials
router.get(
  '/applications/:id/materials',
  protect,
  requireClipperRole,
  validate({ params: applicationIdParamSchema }),
  applicationController.getMaterials
);

// DELETE /applications/:id
router.delete(
  '/applications/:id',
  protect,
  requireClipperRole,
  validate({ params: applicationIdParamSchema }),
  applicationController.withdraw
);

// ─────────────────────────────────────────────
// ── Advertiser side (owner: A) ──
// ─────────────────────────────────────────────
// TODO(A): GET /campaigns/:campaignId/applications
// TODO(A): PUT /applications/:id/status

module.exports = router;