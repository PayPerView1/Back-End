const express = require('express');
const router = express.Router();

const { protect } = require('../../middlewares/authMiddleware');
const { requireBrandRole, requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const applicationValidator = require('../../validators/application/applicationReview.validator');
const applicationController = require('../../controllers/application/application.controller');
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


// Advertiser side
router.get(
  '/campaigns/:campaignId/applications',
  protect,
  requireBrandRole,
  applicationValidator.validateCampaignIdParam,      // ✅ مصفوفة middleware
  applicationValidator.validateListApplicationsQuery, // ✅ مصفوفة middleware
  applicationValidator.validate,                      // ✅ middleware بلا ()
  applicationController.getCampaignApplications
);

router.put(
  '/applications/:id/status',
  protect,
  requireBrandRole,
  applicationValidator.validateApplicationIdParam,    // ✅
  applicationValidator.validateUpdateApplicationStatus, // ✅
  applicationValidator.validate,                        // ✅
  applicationController.updateApplicationStatus
);

module.exports = router;