// src/routes/campaign/campaignManagement.routes.js
const express = require('express');
const router = express.Router();

// Controllers
const campaignManagementController = require('../../controllers/campaign/campaignManagement.controller');
const campaignBudgetController = require('../../controllers/wallet/campaignBudget.controller');

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

/**
 * @route   GET /api/v1/campaigns/:campaignId/statistics
 * @desc    Get campaign statistics by ID
 * @access  Private (BRAND)
 */
router.get(
  '/:campaignId/statistics',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignManagementController.getCampaignStatisticsById
);

// ═════════════════════════════════════════════
// Sprint 3 — Campaign Budget & Payments (T-B-04)
// ═════════════════════════════════════════════

/**
 * @route   PUT /api/v1/campaigns/:campaignId/budget
 * @desc    Allocate / update campaign budget (atomic wallet → campaign transfer)
 * @access  Private (BRAND)
 */
router.put(
  '/:campaignId/budget',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.allocateBudget
);

/**
 * @route   PUT /api/v1/campaigns/:campaignId/daily-budget
 * @desc    Set / update daily budget limit (send null to remove limit)
 * @access  Private (BRAND)
 */
router.put(
  '/:campaignId/daily-budget',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.setDailyBudgetLimit
);

/**
 * @route   POST /api/v1/campaigns/:campaignId/recharge
 * @desc    Recharge campaign budget from wallet (respects autoResumeOnRecharge)
 * @access  Private (BRAND)
 */
router.post(
  '/:campaignId/recharge',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.rechargeCampaign
);

/**
 * @route   PUT /api/v1/campaigns/:campaignId/pause
 * @desc    Manually pause campaign (preserves remaining budget)
 * @access  Private (BRAND)
 */
router.put(
  '/:campaignId/pause',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.pauseCampaign
);

/**
 * @route   PUT /api/v1/campaigns/:campaignId/resume
 * @desc    Manually resume paused campaign (validates remainingBudget > 0)
 * @access  Private (BRAND)
 */
router.put(
  '/:campaignId/resume',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.resumeCampaign
);

/**
 * @route   PUT /api/v1/campaigns/:campaignId/auto-resume
 * @desc    Configure whether campaign auto-resumes on recharge after budget exhaustion
 * @access  Private (BRAND)
 */
router.put(
  '/:campaignId/auto-resume',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.setAutoResume
);

/**
 * @route   PUT /api/v1/campaigns/:campaignId/auto-recharge
 * @desc    Auto-recharge configuration (deferred — returns 501 Not Implemented)
 * @access  Private (BRAND)
 */
router.put(
  '/:campaignId/auto-recharge',
  validateCampaignId,
  validate,
  verifyCampaignOwnership,
  campaignBudgetController.autoRechargeStub
);

// ═════════════════════════════════════════════
// Delete (must be last — catches DELETE /:campaignId)
// ═════════════════════════════════════════════

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

module.exports = router;