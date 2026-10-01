// src/controllers/campaign/campaignCreation.controller.js
const { createCampaign: createCampaignService, submitCampaignForReview, runCampaignAIReview } = require('../../services/campaign/campaignCreation.service');

// ============================================
// 5.2.1 — POST /api/v1/campaigns
// ============================================
/**
 * بتنشئ الحملة وتسلمها فورًا للمراجعة (بعكس المسودات، هون البيانات كاملة أصلاً
 * لأنها عدّت validateCampaignCreation قبل ما توصل هون)
 */
const createCampaign = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const files = req.files || [];

    // 1. إنشاء الحملة (بحالة PENDING_REVIEW مبدئيًا)
    const campaign = await createCampaignService(advertiserId, req.body, files, req.ip);

   // 2. إرجاع الحملة بدون استدعاء AI review
    res.status(201).json({
      success: true,
      message: 'Campaign created and submitted for review',
      campaign,
    });
  } catch (error) {
    // console.error(`[campaignCreation.controller] createCampaign error: ${error.message}`);
    console.error('[campaignCreation.controller] createCampaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating campaign',
    });
  }
};

// ============================================
// 5.2.2 — GET /api/v1/campaigns/:campaignId/ai-review
// ============================================
/**
 * ⚠️ بيعتمد على verifyCampaignOwnership يلي بيحط الحملة أصلاً بـ req.campaign
 */
const getAIReviewResult = async (req, res) => {
  try {
    const campaign = req.campaign;

    res.status(200).json({
      success: true,
      aiReview: campaign.aiReview,
    });
  } catch (error) {
    console.error(`[campaignCreation.controller] getAIReviewResult error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching AI review result',
    });
  }
};
const triggerAIReview = async (req, res) => {
  try {
    const campaign = req.campaign;

    const updatedCampaign = await runCampaignAIReview(campaign);

    return res.status(200).json({
      success: true,
      message: 'AI review completed',
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('[campaignCreation.controller] triggerAIReview error:', error);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while running AI review',
    });
  }
};

module.exports = {
  createCampaign,
  getAIReviewResult,
  triggerAIReview,
};