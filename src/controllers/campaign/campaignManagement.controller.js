// src/controllers/campaign/campaignManagement.controller.js

const campaignManagementService = require('../../services/campaign/campaignManagement.service');

// ─────────────────────────────────────────────
// Step 2: Core Retrieval Controllers
// ─────────────────────────────────────────────

/**
 * 1. getCampaigns
 * Handles GET /api/v1/campaigns
 */
const getCampaigns = async (req, res) => {
  try {
    const advertiserId = req.user._id;

    const { campaigns, pagination, summary } =
      await campaignManagementService.getCampaigns(advertiserId, req.query);

    return res.status(200).json({
      status: 'success',
      data: {
        campaigns,
        pagination,
        summary,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 2. getCampaignById
 * Handles GET /api/v1/campaigns/:campaignId
 */
const getCampaignById = async (req, res) => {
 try {
    // req.campaign is already verified and attached by verifyCampaignOwnership middleware
    const { campaign, statusHistory } =
      await campaignManagementService.getCampaignById(req.campaign);

    return res.status(200).json({
      status: 'success',
      data: {
        campaign: {
          ...campaign,
          statusHistory,
        },
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};


/**
 * 3. getCampaignStatistics
 * Handles GET /api/v1/campaigns/statistics
 */
const getCampaignStatistics = async (req, res) => {
  try {
    const advertiserId = req.user._id;

    const statistics =
      await campaignManagementService.getCampaignStatistics(advertiserId);

    return res.status(200).json({
      status: 'success',
      data: {
        statistics,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

// ─────────────────────────────────────────────
// Step 3: Single Campaign Action Controllers
// ─────────────────────────────────────────────

/**
 * 4. copyCampaign
 * Handles POST /api/v1/campaigns/:campaignId/copy
 */
const copyCampaign = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignId } = req.params;
    const { newName, includeMaterials } = req.body;

    const draft = await campaignManagementService.copyCampaign(
      campaignId,
      advertiserId,
      { newName, includeMaterials }
    );

    return res.status(201).json({
      status: 'success',
      message: 'Campaign copied successfully',
      data: {
        draft,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 5. archiveCampaign
 * Handles PATCH /api/v1/campaigns/:campaignId/archive
 */
const archiveCampaign = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignId } = req.params;

    const result = await campaignManagementService.archiveCampaign(
      campaignId,
      advertiserId
    );

    return res.status(200).json({
      status: 'success',
      message: 'Campaign archived successfully',
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 6. restoreCampaign
 * Handles PATCH /api/v1/campaigns/:campaignId/restore
 */
const restoreCampaign = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignId } = req.params;

    const result = await campaignManagementService.restoreCampaign(
      campaignId,
      advertiserId
    );

    return res.status(200).json({
      status: 'success',
      message: 'Campaign restored successfully',
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 7. deleteCampaign
 * Handles DELETE /api/v1/campaigns/:campaignId
 */
const deleteCampaign = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignId } = req.params;

    await campaignManagementService.deleteCampaign(campaignId, advertiserId);

    return res.status(200).json({
      status: 'success',
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

// ─────────────────────────────────────────────
// Step 4: Bulk Action & Export Controllers
// ─────────────────────────────────────────────

/**
 * 8. bulkDelete
 * Handles POST /api/v1/campaigns/bulk-delete
 */
const bulkDelete = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignIds } = req.body;

    const result = await campaignManagementService.bulkDeleteCampaigns(
      campaignIds,
      advertiserId
    );

    return res.status(200).json({
      status: 'success',
      message: 'Bulk delete completed',
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 9. bulkArchive
 * Handles POST /api/v1/campaigns/bulk-archive
 */
const bulkArchive = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignIds } = req.body;

    const result = await campaignManagementService.bulkArchiveCampaigns(
      campaignIds,
      advertiserId
    );

    return res.status(200).json({
      status: 'success',
      message: 'Bulk archive completed',
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 10. exportCampaignToCSV
 * Handles GET /api/v1/campaigns/:campaignId/export
 */
const exportCampaignToCSV = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const { campaignId } = req.params;

    const csvContent = await campaignManagementService.exportCampaignToCSV(
      campaignId,
      advertiserId
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="campaign-${campaignId}-export.csv"`
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = {
  getCampaigns,
  getCampaignById,
  getCampaignStatistics,
  copyCampaign,
  archiveCampaign,
  restoreCampaign,
  deleteCampaign,
  bulkDelete,
  bulkArchive,
  exportCampaignToCSV,
};