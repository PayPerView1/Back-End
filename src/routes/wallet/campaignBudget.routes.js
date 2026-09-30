// src/routes/wallet/campaignBudget.routes.js

const express = require('express');
const router = express.Router({ mergeParams: true });
// mergeParams: true ضروري عشان نوصل لـ :campaignId من الـ parent route

const {
  allocateBudget,
  setDailyBudgetLimit,
  rechargeCampaign,
  pauseCampaign,
  resumeCampaign,
  setAutoResume,
  autoRechargeStub,
} = require('../../controllers/wallet/campaignBudget.controller');

const { protect } = require('../../middlewares/authMiddleware');
const {
  requireBrandRole,
  verifyCampaignOwnership,
} = require('../../middlewares/campaign/campaignValidationMiddleware');

// ─────────────────────────────────────────────
// Global Middlewares — نفس أسلوب campaignManagement.routes.js
// ─────────────────────────────────────────────
router.use(protect, requireBrandRole);

// ─────────────────────────────────────────────
// كل الـ routes تمر على verifyCampaignOwnership
// الذي يتحقق من :campaignId ويضع الحملة في req.campaign
// ─────────────────────────────────────────────

// PUT /api/v1/campaigns/:campaignId/budget
router.put('/budget',        verifyCampaignOwnership, allocateBudget);

// PUT /api/v1/campaigns/:campaignId/daily-budget
router.put('/daily-budget',  verifyCampaignOwnership, setDailyBudgetLimit);

// POST /api/v1/campaigns/:campaignId/recharge
router.post('/recharge',     verifyCampaignOwnership, rechargeCampaign);

// PUT /api/v1/campaigns/:campaignId/pause
router.put('/pause',         verifyCampaignOwnership, pauseCampaign);

// PUT /api/v1/campaigns/:campaignId/resume
router.put('/resume',        verifyCampaignOwnership, resumeCampaign);

// PUT /api/v1/campaigns/:campaignId/auto-resume
router.put('/auto-resume',   verifyCampaignOwnership, setAutoResume);

// PUT /api/v1/campaigns/:campaignId/auto-recharge — Stub
router.put('/auto-recharge', autoRechargeStub);

module.exports = router;