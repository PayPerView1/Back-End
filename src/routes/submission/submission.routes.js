// src/routes/submission/submission.routes.js
// ملف مشترك بين المسارين (أ و ب).
//
// ⚠️ قواعد:
//  - لا تستعمل router.use(protect, ...) عاماً — الـ middleware على كل route.
//  - المسارات الثابتة قبل الـ parametric (مثل /submissions/my قبل /submissions/:id).
//  - قسم المسار أ (owner: A) يضاف أسفل قسم المسار ب بتعليق فاصل.
//
// الترتيب الحالي:
//   1. eligible-campaigns, verify-link (من A)
//   2. submission-requirements, submission-draft (من A)
//   3. submissions (create, my, detail, withdraw, updateLink, resubmit) — من B
//
// ⚠️ هذا الـ router مُركَّب على /api/v1 — المسارات كاملة.

const express = require('express');
const router = express.Router();

const submissionController = require('../../controllers/submission/submission.controller');
const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const {
  campaignIdParamSchema,
  submissionIdParamSchema,
  createSubmissionBodySchema,
  mySubmissionsQuerySchema,
  updateLinkBodySchema,
  resubmitBodySchema,
} = require('../../validators/submission/submission.validator');

// ═══════════════════════════════════════════════════════════════
// المسار ب — دورة التسليم (owner: B)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// المسار أ — تجهيز التسليم (owner: A)
// ═══════════════════════════════════════════════════════════════
// TODO(A):
//   GET  /submissions/eligible-campaigns
//   GET  /campaigns/:campaignId/submission-requirements
//   POST /submissions/verify-link
//   GET  /campaigns/:campaignId/submission-draft
//   PUT  /campaigns/:campaignId/submission-draft
//   DELETE /campaigns/:campaignId/submission-draft
//
// ⚠️ المسارات الثابتة لازم تجي قبل /:id:
//   - /submissions/eligible-campaigns قبل /submissions/:id
//   - /submissions/verify-link قبل /submissions/:id

module.exports = router;