// src/routes/campaign/campaignManagement.routes.js
const express = require('express');
const router = express.Router();

// Controllers
const campaignManagementController = require('../../controllers/campaign/campaignManagement.controller');
// Middlewares
const { protect } = require('../../middlewares/authMiddleware');
const {
  requireBrandRole,
  verifyCampaignOwnership,
} = require('../../middlewares/campaign/campaignValidationMiddleware');

// Validators
const {
  validateGetCampaigns,
  validateCampaignId,
  validateCopyCampaign,
  validateBulkAction,
  validate,
} = require('../../validators/campaign/campaignManagement.validator');

// ─────────────────────────────────────────────
// Apply Global Middlewares for Management Routes
// All routes require authentication & BRAND role
// ─────────────────────────────────────────────
router.use(protect, requireBrandRole);

// ─────────────────────────────────────────────
// Sub-step 3.1: Static Endpoints (Top)
// Defined first to prevent collision with :campaignId
// ─────────────────────────────────────────────

/**
 * @route   GET /api/v1/campaigns/statistics
 * @desc    Get dashboard statistics summary for the authenticated brand
 * @access  Private (BRAND)
 */
router.get(
  '/statistics',
  campaignManagementController.getCampaignStatistics
);

/**
 * @route   POST /api/v1/campaigns/bulk-delete
 * @desc    Delete multiple campaigns
 * @access  Private (BRAND)
 */
router.post(
  '/bulk-delete',
  validateBulkAction,
  validate,
  campaignManagementController.bulkDelete
);

/**
 * @route   POST /api/v1/campaigns/bulk-archive
 * @desc    Archive multiple campaigns
 * @access  Private (BRAND)
 */
router.post(
  '/bulk-archive',
  validateBulkAction,
  validate,
  campaignManagementController.bulkArchive
);

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get paginated campaign list with filters and search
 * @access  Private (BRAND)
 */
router.get(
  '/',
  validateGetCampaigns,
  validate,
  campaignManagementController.getCampaigns
);

// ─────────────────────────────────────────────
// Sub-step 3.2: Parametric Endpoints (:campaignId) (Bottom)
// ─────────────────────────────────────────────

/**
 * @route   GET /api/v1/campaigns/:campaignId
 * @desc    Get detailed information for a single campaign
 * @access  Private (BRAND)
 */
router.get(
  '/:campaignId',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.getCampaignById
);

/**
 * @route   POST /api/v1/campaigns/:campaignId/copy
 * @desc    Copy an existing campaign as a draft
 * @access  Private (BRAND)
 */
router.post(
  '/:campaignId/copy',
  validateCampaignId,
  validateCopyCampaign,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.copyCampaign
);

/**
 * @route   PATCH /api/v1/campaigns/:campaignId/archive
 * @desc    Archive a completed, rejected, cancelled, or expired campaign
 * @access  Private (BRAND)
 */

router.patch(
  '/:campaignId/archive',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.archiveCampaign
);

/**
 * @route   PATCH /api/v1/campaigns/:campaignId/restore
 * @desc    Restore an archived campaign
 * @access  Private (BRAND)
 */
router.patch(
  '/:campaignId/restore',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.restoreCampaign
);

/**
 * @route   DELETE /api/v1/campaigns/:campaignId
 * @desc    Delete a DRAFT or REJECTED campaign
 * @access  Private (BRAND)
 */
router.delete(
  '/:campaignId',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.deleteCampaign
);

/**
 * @route   GET /api/v1/campaigns/:campaignId/export
 * @desc    Export campaign data to CSV format
 * @access  Private (BRAND)
 */
router.get(
  '/:campaignId/export',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.exportCampaignToCSV
);

module.exports = router;