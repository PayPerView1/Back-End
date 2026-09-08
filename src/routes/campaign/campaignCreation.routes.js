// src/routes/campaign/campaignCreation.routes.js
const express = require('express');
const router = express.Router();

const { createCampaign, getAIReviewResult } = require('../../controllers/campaign/campaignCreation.controller');
const { protect: authMiddleware } = require('../../middlewares/authMiddleware');
const {
  requireBrandRole,
  verifyCampaignOwnership,
} = require('../../middlewares/campaign/campaignValidationMiddleware');
const { uploadMaterials } = require('../../services/campaign/fileUpload.service');
const { campaignCreationRules, validate } = require('../../validators/campaign/campaignCreation.validator');

// @route   POST /api/v1/campaigns
// @desc    إنشاء حملة جديدة كاملة وتسليمها فورًا للمراجعة
// @access  Private (Brand only)
router.post(
  '/',
  authMiddleware,
  requireBrandRole,
  uploadMaterials, // multer — بيرفع الملفات ويحطهم بـ req.files قبل الفاليديشن
  campaignCreationRules,
  validate,
  createCampaign
);

// @route   GET /api/v1/campaigns/:campaignId/ai-review
// @desc    جلب نتيجة مراجعة الـ AI لحملة معينة
// @access  Private (لازم يكون صاحب الحملة)
router.get('/:campaignId/ai-review', authMiddleware, verifyCampaignOwnership, getAIReviewResult);

module.exports = router;