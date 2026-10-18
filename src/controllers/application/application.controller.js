// src/controllers/application/application.controller.js
// المالك: الشخص B — HTTP handlers للتقديم (جانب المبدع).
// المرجع: API_CONTRACT_Sprint4.md §4.1-4.4

const applicationService = require('../../services/application/application.service');
const { sendError } = require('../../utils/errors');

// ============================================
// POST /api/v1/campaigns/:campaignId/apply
// ============================================
const apply = async (req, res) => {
  try {
    const { campaignId } = req.validated?.params || req.params;
    const { message } = req.validated?.body || req.body;

    const data = await applicationService.applyToCampaign(
      req.user,
      campaignId,
      { message }
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'application.apply');
  }
};

// ============================================
// DELETE /api/v1/applications/:id
// ============================================
const withdraw = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const data = await applicationService.withdrawApplication(id, req.user._id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'application.withdraw');
  }
};

// ============================================
// GET /api/v1/applications/my
// ============================================
const myApplications = async (req, res) => {
  try {
    const filters = req.validated?.query || req.query;
    const { data, pagination } = await applicationService.getMyApplications(
      req.user._id,
      filters
    );

    return res.status(200).json({
      success: true,
      data,
      pagination,
    });
  } catch (error) {
    return sendError(res, error, 'application.myApplications');
  }
};

// ============================================
// GET /api/v1/applications/:id/materials
// ============================================
const getMaterials = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const data = await applicationService.getAcceptedMaterials(id, req.user._id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'application.getMaterials');
  }
};

module.exports = {
  apply,
  withdraw,
  myApplications,
  getMaterials,
};