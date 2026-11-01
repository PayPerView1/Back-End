// src/controllers/submission/submission.controller.js
// المالك: المسار ب — HTTP handlers لدورة التسليم (جانب المبدع).
// المرجع: API_CONTRACT_Sprint5.md §5

const submissionService = require('../../services/submission/submission.service');
const { sendError } = require('../../utils/errors');

// ============================================
// POST /api/v1/campaigns/:campaignId/submissions
// ============================================
const create = async (req, res) => {
  try {
    const { campaignId } = req.validated?.params || req.params;
    const body = req.validated?.body || req.body;

    const data = await submissionService.createSubmission(
      req.user._id,
      campaignId,
      body
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submission.create');
  }
};

// ============================================
// GET /api/v1/submissions/my
// ============================================
const getMySubmissions = async (req, res) => {
  try {
    const filters = req.validated?.query || req.query;
    const { data, pagination } = await submissionService.getMySubmissions(
      req.user._id,
      filters
    );

    return res.status(200).json({
      success: true,
      data,
      pagination,
    });
  } catch (error) {
    return sendError(res, error, 'submission.getMySubmissions');
  }
};

// ============================================
// GET /api/v1/submissions/:id
// ============================================
const getById = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const data = await submissionService.getSubmissionById(id, req.user._id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submission.getById');
  }
};

// ============================================
// DELETE /api/v1/submissions/:id
// ============================================
const withdraw = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const data = await submissionService.withdrawSubmission(id, req.user._id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submission.withdraw');
  }
};

// ============================================
// PUT /api/v1/submissions/:id/link
// ============================================
const updateLink = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const { url, reason } = req.validated?.body || req.body;

    const data = await submissionService.updateSubmissionLink(
      id,
      req.user._id,
      { url, reason }
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submission.updateLink');
  }
};

// ============================================
// POST /api/v1/submissions/:id/resubmit
// ============================================
const resubmit = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const body = req.validated?.body || req.body;

    const data = await submissionService.resubmitSubmission(
      id,
      req.user._id,
      body
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submission.resubmit');
  }
};

module.exports = {
  create,
  getMySubmissions,
  getById,
  withdraw,
  updateLink,
  resubmit,
};