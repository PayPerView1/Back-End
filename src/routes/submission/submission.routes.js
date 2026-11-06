// src/routes/submission/submission.routes.js
// ⚠️ router يمتد على أكثر من بادئة: يُركَّب على /api/v1 ومساراته كاملة،
//    ممنوع فيه router.use(protect, ...)، والـ middleware على كل route على حدة.
// ⚠️ الترتيب: المسارات الثابتة (eligible-campaigns, verify-link, my) قبل /submissions/:id
//
// الملف مشترك: كل مسار يضيف في قسمه فقط.
const express = require('express');

const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole, requireBrandRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const { verifyLinkRateLimiter } = require('../../middlewares/submission/submissionRateLimiter');
const { verifyLinkBodySchema } = require('../../validators/submission/submissionPrep.validator');
const submissionVerifyController = require('../../controllers/submission/submissionVerify.controller');
const submissionDraftController = require('../../controllers/submission/submissionDraft.controller');
const { submissionDraftSchema } = require('../../validators/submission/submissionPrep.validator');
const router = express.Router();
const submissionEligibilityController = require('../../controllers/submission/submissionEligibility.controller');
const {
  campaignIdParamSchema,
  submissionIdParamSchema,
  createSubmissionBodySchema,
  mySubmissionsQuerySchema,
  updateLinkBodySchema,
  resubmitBodySchema,
} = require('../../validators/submission/submission.validator');
const submissionController = require('../../controllers/submission/submission.controller');
const submissionReviewController = require('../../controllers/submission/submissionReview.controller');
const {
  campaignSubmissionsQuerySchema,
  reviewSubmissionBodySchema,
} = require('../../validators/submission/submissionReview.validator');
// ═══════════════════════════════════════════════════════════════
// المسار أ: تجهيز التسليم
//   GET    /submissions/eligible-campaigns                  (A3) ✅
//   POST   /submissions/verify-link                         (A2) ✅
//   GET    /campaigns/:campaignId/submission-requirements   (A3) ✅
//   GET/PUT/DELETE /campaigns/:campaignId/submission-draft  (A4) ✅
// ═══════════════════════════════════════════════════════════════

// POST /submissions/verify-link
router.post(
  '/submissions/verify-link',
  protect,
  requireClipperRole,
  verifyLinkRateLimiter,
  validate({ body: verifyLinkBodySchema }),
  submissionVerifyController.verifyLink
);


// GET /submissions/eligible-campaigns
router.get(
  '/submissions/eligible-campaigns',
  protect,
  requireClipperRole,
  submissionEligibilityController.getEligibleCampaignsController
);

// GET /campaigns/:campaignId/submission-requirements
router.get(
  '/campaigns/:campaignId/submission-requirements',
  protect,
  requireClipperRole,
  submissionEligibilityController.getSubmissionRequirementsController
);

// Add these routes in the "المسار أ" section (after the existing routes)
// GET /campaigns/:campaignId/submission-draft
router.get(
  '/campaigns/:campaignId/submission-draft',
  protect,
  requireClipperRole,
  submissionDraftController.getDraftController
);

// PUT /campaigns/:campaignId/submission-draft
router.put(
  '/campaigns/:campaignId/submission-draft',
  protect,
  requireClipperRole,
  submissionDraftController.upsertDraftController
);

// DELETE /campaigns/:campaignId/submission-draft
router.delete(
  '/campaigns/:campaignId/submission-draft',
  protect,
  requireClipperRole,
  validate({ body: submissionDraftSchema }),
  submissionDraftController.deleteDraftController
);
// ═══════════════════════════════════════════════════════════════
// المسار ب: دورة التسليم
//   GET    /submissions/my                                  (B2)
//   POST   /campaigns/:campaignId/submissions               (B1)
//   GET    /campaigns/:campaignId/submissions               (B5، المعلن)
//   GET    /submissions/:id                                 (B2)   ← بعد كل الثابتة
//   DELETE /submissions/:id                                 (B4)
//   PUT    /submissions/:id/link                            (B4)
//   POST   /submissions/:id/resubmit                        (B4)
//   PUT    /submissions/:id/review                          (B5، المعلن)
// ─────────────────────────────────────────────
// Static paths first
// ─────────────────────────────────────────────

// GET /submissions/my
router.get(
  '/submissions/my',
  protect,
  requireClipperRole,
  validate({ query: mySubmissionsQuerySchema }),
  submissionController.getMySubmissions
);

// ─────────────────────────────────────────────
// POST /campaigns/:campaignId/submissions
// ─────────────────────────────────────────────
router.post(
  '/campaigns/:campaignId/submissions',
  protect,
  requireClipperRole,
  validate({
    params: campaignIdParamSchema,
    body: createSubmissionBodySchema,
  }),
  submissionController.create
);

// ─────────────────────────────────────────────
// GET /campaigns/:campaignId/submissions — BRAND (B5)
// ─────────────────────────────────────────────
router.get(
  '/campaigns/:campaignId/submissions',
  protect,
  requireBrandRole,
  validate({
    params: campaignIdParamSchema,
    query: campaignSubmissionsQuerySchema,
  }),
  submissionReviewController.getCampaignSubmissions
);

// ─────────────────────────────────────────────
// Parametric paths (submissions/:id)
// ─────────────────────────────────────────────

// GET /submissions/:id
router.get(
  '/submissions/:id',
  protect,
  requireClipperRole,
  validate({ params: submissionIdParamSchema }),
  submissionController.getById
);

// DELETE /submissions/:id
router.delete(
  '/submissions/:id',
  protect,
  requireClipperRole,
  validate({ params: submissionIdParamSchema }),
  submissionController.withdraw
);

// PUT /submissions/:id/link
router.put(
  '/submissions/:id/link',
  protect,
  requireClipperRole,
  validate({
    params: submissionIdParamSchema,
    body: updateLinkBodySchema,
  }),
  submissionController.updateLink
);

// POST /submissions/:id/resubmit
router.post(
  '/submissions/:id/resubmit',
  protect,
  requireClipperRole,
  validate({
    params: submissionIdParamSchema,
    body: resubmitBodySchema,
  }),
  submissionController.resubmit
);

// PUT /submissions/:id/review — BRAND (B5)
router.put(
  '/submissions/:id/review',
  protect,
  requireBrandRole,
  validate({
    params: submissionIdParamSchema,
    body: reviewSubmissionBodySchema,
  }),
  submissionReviewController.reviewSubmission
);

module.exports = router;