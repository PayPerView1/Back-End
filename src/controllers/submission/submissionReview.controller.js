// src/controllers/submission/submissionReview.controller.js
// المالك: المسار ب — HTTP handlers لمراجعة التسليمات (المعلن والأدمن).
// المرجع: API_CONTRACT_Sprint5.md §6

const submissionReviewService = require('../../services/submission/submissionReview.service');
const { sendError } = require('../../utils/errors');

// ============================================
// GET /api/v1/campaigns/:campaignId/submissions — BRAND
// ============================================
const getCampaignSubmissions = async (req, res) => {
  try {
    const { campaignId } = req.validated?.params || req.params;
    const filters = req.validated?.query || req.query;

    const { data, pagination } =
      await submissionReviewService.getCampaignSubmissions(
        campaignId,
        req.user._id,
        filters
      );

    return res.status(200).json({
      success: true,
      data,
      pagination,
    });
  } catch (error) {
    return sendError(res, error, 'submissionReview.getCampaignSubmissions');
  }
};

// ============================================
// PUT /api/v1/submissions/:id/review — BRAND
// ============================================
const reviewSubmission = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const { decision, note } = req.validated?.body || req.body;

    const data = await submissionReviewService.reviewSubmission(
      id,
      req.user._id,
      { decision, note }
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submissionReview.reviewSubmission');
  }
};

const bulkApproveSubmissions = async (req, res) => {
  try {
    const { campaignId } = req.validated?.params || req.params;
    const { submissionIds } = req.validated?.body || req.body;
    const data = await submissionReviewService.bulkApproveSubmissions(
      campaignId,
      req.user._id,
      submissionIds
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'submissionReview.bulkApproveSubmissions');
  }
};

const bulkReviewSubmissions = async (req, res) => {
  try {
    const { campaignId } = req.validated?.params || req.params;
    const data = await submissionReviewService.bulkReviewSubmissions(
      campaignId,
      req.user._id,
      req.validated?.body || req.body
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'submissionReview.bulkReviewSubmissions');
  }
};

// ============================================
// GET /api/v1/admin/submissions/manual-review — ADMIN
// ============================================
const getManualReviewQueue = async (req, res) => {
  try {
    const filters = req.validated?.query || req.query;
    const { data, pagination } =
      await submissionReviewService.getManualReviewQueue(filters);

    return res.status(200).json({
      success: true,
      data,
      pagination,
    });
  } catch (error) {
    return sendError(res, error, 'submissionReview.getManualReviewQueue');
  }
};

// ============================================
// PUT /api/v1/admin/submissions/:id/review — ADMIN
// ============================================
const decideManualReview = async (req, res) => {
  try {
    const { id } = req.validated?.params || req.params;
    const { decision, note } = req.validated?.body || req.body;

    const data = await submissionReviewService.decideManualReview(
      id,
      req.user._id,
      { decision, note }
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'submissionReview.decideManualReview');
  }
};

module.exports = {
  getCampaignSubmissions,
  reviewSubmission,
  bulkApproveSubmissions,
  bulkReviewSubmissions,
  getManualReviewQueue,
  decideManualReview,
};
