// src/routes/submission/submissionAdmin.routes.js
// المالك: المسار ب — مسارات الأدمن للمراجعة اليدوية.
// المرجع: API_CONTRACT_Sprint5.md §6.3-6.4
//
// ⚠️ هذا الـ router مُركَّب على /api/v1 (المسارات كاملة).
//    لا تستعمل router.use(protect, ...) عاماً — الـ middleware على كل route.

const express = require('express');
const router = express.Router();

const submissionReviewController = require('../../controllers/submission/submissionReview.controller');
const { protect } = require('../../middlewares/authMiddleware');
const adminOnly = require('../../middlewares/adminOnly');
const { validate } = require('../../middlewares/validate.middleware');
const {
  submissionIdParamSchema,
  manualReviewQueueQuerySchema,
  adminReviewBodySchema,
} = require('../../validators/submission/submissionReview.validator');

// ─────────────────────────────────────────────
// GET /admin/submissions/manual-review
// ─────────────────────────────────────────────
router.get(
  '/admin/submissions/manual-review',
  protect,
  adminOnly,
  validate({ query: manualReviewQueueQuerySchema }),
  submissionReviewController.getManualReviewQueue
);

// ─────────────────────────────────────────────
// PUT /admin/submissions/:id/review
// ─────────────────────────────────────────────
router.put(
  '/admin/submissions/:id/review',
  protect,
  adminOnly,
  validate({ params: submissionIdParamSchema, body: adminReviewBodySchema }),
  submissionReviewController.decideManualReview
);

module.exports = router;