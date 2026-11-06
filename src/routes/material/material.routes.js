// src/routes/material/material.routes.js
const express = require('express');
const router = express.Router();
const materialController = require('../../controllers/material/materialDownload.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { protect } = require('../../middlewares/authMiddleware');
const {
  redeemParamsSchema, downloadIdParamsSchema, reportDownloadBodySchema,
  campaignDownloadsParamsSchema, campaignDownloadsQuerySchema,
  downloadLinkParamsSchema, downloadAllParamsSchema,
} = require('../../validators/material/material.validator');
const { verifyCampaignOwnership, requireBrandRole, requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');

// ── A5.3: إصدار روابط التنزيل ──
// المسار الثابت أولاً (download-all) قبل المتغيّر (:materialId)
router.post('/applications/:id/materials/download-all',
  protect, requireClipperRole,
  validate({ params: downloadAllParamsSchema }),
  materialController.issueAll);

router.post('/applications/:id/materials/:materialId/download-link',
  protect, requireClipperRole,
  validate({ params: downloadLinkParamsSchema }),
  materialController.issueLink);

// ── A5.4: استهلاك الرابط ──
router.get('/materials/download/:token',
  protect, requireClipperRole,
  validate({ params: redeemParamsSchema }),
  materialController.redeem);

router.patch('/downloads/:logId',
  protect, requireClipperRole,
  validate({ params: downloadIdParamsSchema, body: reportDownloadBodySchema }),
  materialController.reportResult);

router.get('/campaigns/:campaignId/downloads',
  protect, requireBrandRole, verifyCampaignOwnership,
  validate({ params: campaignDownloadsParamsSchema, query: campaignDownloadsQuerySchema }),
  materialController.campaignDownloads);

module.exports = router;