// src/controllers/wallet/campaignBudget.controller.js

const campaignBudgetService = require('../../services/wallet/campaignBudget.service');

// ============================================
// PUT /api/v1/campaigns/:campaignId/budget
// ============================================
const allocateBudget = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { amount } = req.body;

    const result = await campaignBudgetService.allocateBudget(
      campaignId,
      req.user._id,
      amount
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[campaignBudget.controller] allocateBudget error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ success: false, message: error.message, code: 'INSUFFICIENT_BALANCE' });
    }
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, message: error.message, code: 'VALIDATION_ERROR' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while allocating budget',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/daily-budget
// ============================================
const setDailyBudgetLimit = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { dailyBudgetLimit } = req.body;

    const result = await campaignBudgetService.setDailyBudgetLimit(
      campaignId,
      req.user._id,
      dailyBudgetLimit
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[campaignBudget.controller] setDailyBudgetLimit error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, message: error.message, code: 'VALIDATION_ERROR' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while setting daily budget',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/v1/campaigns/:campaignId/recharge
// ============================================
const rechargeCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { amount } = req.body;

    const result = await campaignBudgetService.rechargeCampaign(
      campaignId,
      req.user._id,
      amount
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[campaignBudget.controller] rechargeCampaign error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ success: false, message: error.message, code: 'INSUFFICIENT_BALANCE' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while recharging campaign',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/pause
// ============================================
const pauseCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const result = await campaignBudgetService.pauseCampaign(campaignId, req.user._id);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[campaignBudget.controller] pauseCampaign error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, message: error.message, code: 'VALIDATION_ERROR' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while pausing campaign',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/resume
// ============================================
const resumeCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const result = await campaignBudgetService.resumeCampaign(campaignId, req.user._id);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[campaignBudget.controller] resumeCampaign error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ success: false, message: error.message, code: 'INSUFFICIENT_BALANCE' });
    }
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, message: error.message, code: 'VALIDATION_ERROR' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while resuming campaign',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/auto-resume
// ============================================
const setAutoResume = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { autoResumeOnRecharge } = req.body;

    const result = await campaignBudgetService.setAutoResume(
      campaignId,
      req.user._id,
      autoResumeOnRecharge
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`[campaignBudget.controller] setAutoResume error: ${error.message}`);

    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message, code: 'NOT_FOUND' });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while setting auto-resume',
      code: 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/auto-recharge (Stub)
// ============================================
const autoRechargeStub = (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Auto-recharge is not available yet.',
    code: 'NOT_IMPLEMENTED',
  });
};

module.exports = {
  allocateBudget,
  setDailyBudgetLimit,
  rechargeCampaign,
  pauseCampaign,
  resumeCampaign,
  setAutoResume,
  autoRechargeStub,
};