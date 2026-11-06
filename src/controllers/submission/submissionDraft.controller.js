// src/controllers/submission/submissionDraft.controller.js
const { sendError } = require('../../utils/errors');
const { getDraft, upsertDraft, deleteDraft } = require('../../services/submission/submissionDraft.service');

/**
 * GET /campaigns/:campaignId/submission-draft
 * Get the submission draft for a creator in a specific campaign
 */
const getDraftController = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const draft = await getDraft(req.user._id, campaignId);

    return res.status(200).json({
      success: true,
      data: draft, // null if no draft exists
    });
  } catch (error) {
    return sendError(res, error, 'submissionDraft.controller.getDraft');
  }
};

/**
 * PUT /campaigns/:campaignId/submission-draft
 * Create or update a submission draft (upsert)
 */
const upsertDraftController = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const data = req.body; // { platform, url, notes, halalPledge }

    const draft = await upsertDraft(req.user._id, campaignId, data);

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (error) {
    return sendError(res, error, 'submissionDraft.controller.upsertDraft');
  }
};

/**
 * DELETE /campaigns/:campaignId/submission-draft
 * Delete a submission draft
 */
const deleteDraftController = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const deleted = await deleteDraft(req.user._id, campaignId);

    return res.status(200).json({
      success: true,
      data: { deleted }, // <-- Use the actual result
    });
  } catch (error) {
    return sendError(res, error, 'submissionDraft.controller.deleteDraft');
  }
};

module.exports = {
  getDraftController,
  upsertDraftController,
  deleteDraftController,
};