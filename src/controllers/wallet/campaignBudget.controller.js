// src/controllers/wallet/campaignBudget.controller.js

const campaignBudgetService = require('../../services/wallet/campaignBudget.service');

// ----------------------
// Helper: تحويل error.code لـ HTTP status
// ----------------------
const getStatusFromCode = (code) => {
  switch (code) {
    case 'NOT_FOUND':            return 404;
    case 'FORBIDDEN':            return 403;
    case 'INSUFFICIENT_BALANCE': return 400;
    case 'VALIDATION_ERROR':     return 400;
    default:                     return 500;
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/budget
// ============================================
const allocateBudget = async (req, res) => {
  try {
    const { amount } = req.body;

    const result = await campaignBudgetService.allocateBudget(
      req.campaign._id,
      req.user._id,
      amount
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[campaignBudget.controller] allocateBudget error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/daily-budget
// ============================================
const setDailyBudgetLimit = async (req, res) => {
  try {
    // null يعني إزالة الحد اليومي
    const limit = req.body.dailyBudgetLimit ?? null;

    const result = await campaignBudgetService.setDailyBudgetLimit(
      req.campaign._id,
      req.user._id,
      limit
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[campaignBudget.controller] setDailyBudgetLimit error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// POST /api/v1/campaigns/:campaignId/recharge
// ============================================
const rechargeCampaign = async (req, res) => {
  try {
    const { amount } = req.body;

    const result = await campaignBudgetService.rechargeCampaign(
      req.campaign._id,
      req.user._id,
      amount
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[campaignBudget.controller] rechargeCampaign error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/pause
// ============================================
const pauseCampaign = async (req, res) => {
  try {
    const result = await campaignBudgetService.pauseCampaign(
      req.campaign._id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[campaignBudget.controller] pauseCampaign error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/resume
// ============================================
const resumeCampaign = async (req, res) => {
  try {
    const result = await campaignBudgetService.resumeCampaign(
      req.campaign._id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[campaignBudget.controller] resumeCampaign error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/auto-resume
// ============================================
const setAutoResume = async (req, res) => {
  try {
    const { autoResumeOnRecharge } = req.body;

    if (typeof autoResumeOnRecharge !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'autoResumeOnRecharge must be a boolean',
        code:    'VALIDATION_ERROR',
      });
    }

    const result = await campaignBudgetService.setAutoResume(
      req.campaign._id,
      req.user._id,
      autoResumeOnRecharge
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[campaignBudget.controller] setAutoResume error:', error);
    res.status(getStatusFromCode(error.code)).json({
      success: false,
      message: error.message || 'Server error',
      code:    error.code    || 'INTERNAL_ERROR',
    });
  }
};

// ============================================
// PUT /api/v1/campaigns/:campaignId/auto-recharge
// Stub — deferred
// ============================================
const autoRechargeStub = (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Auto-recharge is not available yet.',
    code:    'NOT_IMPLEMENTED',
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