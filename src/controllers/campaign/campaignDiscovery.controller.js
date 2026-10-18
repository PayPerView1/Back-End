// src/controllers/campaign/campaignDiscovery.controller.js
// المالك: الشخص B — HTTP handlers لـ endpoints الاكتشاف والتفاصيل.
//
// التوصيات (recommendations) انتقلت إلى campaignRecommendation.service.js.

const campaignDiscoveryService = require('../../services/campaign/campaignDiscovery.service');
const campaignRecommendationService = require('../../services/campaign/campaignRecommendation.service');
const { sendError } = require('../../utils/errors');

// ============================================
// GET /api/v1/campaigns/discover
// ============================================
const discover = async (req, res) => {
  try {
    const filters = req.validated?.query || req.query;
    const { data, pagination } = await campaignDiscoveryService.getDiscoverCampaigns(
      req.user._id,
      filters
    );

    return res.status(200).json({
      success: true,
      data,
      pagination,
    });
  } catch (error) {
    return sendError(res, error, 'campaignDiscovery.discover');
  }
};

// ============================================
// GET /api/v1/campaigns/discover/suggestions
// ============================================
const suggestions = async (req, res) => {
  try {
    const { q } = req.validated?.query || req.query;
    const data = await campaignDiscoveryService.getSuggestions(q);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'campaignDiscovery.suggestions');
  }
};

// ============================================
// GET /api/v1/campaigns/:campaignId/details
// ============================================
const getDetails = async (req, res) => {
  try {
    const { campaignId } = req.validated?.params || req.params;
    const data = await campaignDiscoveryService.getCampaignDetails(
      campaignId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'campaignDiscovery.getDetails');
  }
};

// ============================================
// GET /api/v1/campaigns/recommendations
// ============================================
const recommendations = async (req, res) => {
  try {
    const { limit } = req.validated?.query || req.query;
    const { data, meta } = await campaignRecommendationService.getRecommendations(
      req.user._id,
      limit
    );

    return res.status(200).json({
      success: true,
      data,
      meta,
    });
  } catch (error) {
    return sendError(res, error, 'campaignDiscovery.recommendations');
  }
};

module.exports = {
  discover,
  suggestions,
  getDetails,
  recommendations,
};