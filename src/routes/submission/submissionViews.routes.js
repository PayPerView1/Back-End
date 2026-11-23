const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware');
const { requireBrandRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const adminOnly = require('../../middlewares/adminOnly');
const { validate } = require('../../middlewares/validate.middleware');
const controller = require('../../controllers/submission/submissionViews.controller');
const {
  submissionIdParamsSchema,
  campaignIdParamsSchema,
  paginationQuerySchema,
  reviewSnapshotBodySchema,
} = require('../../validators/submission/submissionViews.validator');

router.get(
  '/submissions/:id/views',
  protect,
  validate({ params: submissionIdParamsSchema, query: paginationQuerySchema }),
  controller.getSubmissionViews
);
router.get(
  '/campaigns/:campaignId/analytics',
  protect,
  requireBrandRole,
  validate({ params: campaignIdParamsSchema }),
  controller.getCampaignAnalytics
);
router.get(
  '/admin/view-snapshots/review',
  protect,
  adminOnly,
  validate({ query: paginationQuerySchema }),
  controller.listReviewQueue
);
router.patch(
  '/admin/view-snapshots/:id',
  protect,
  adminOnly,
  validate({ params: submissionIdParamsSchema, body: reviewSnapshotBodySchema }),
  controller.reviewSnapshot
);

module.exports = router;
