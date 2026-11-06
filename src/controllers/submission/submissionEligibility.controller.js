// src/controllers/submission/submissionEligibility.controller.js
const { sendError } = require('../../utils/errors');
const { getEligibleCampaigns, getSubmissionRequirements } = require('../../services/submission/submissionEligibility.service');

const getEligibleCampaignsController = async (req, res) => {
  try {
    const result = await getEligibleCampaigns(req.user._id, req.query);
    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error, 'submissionEligibility.controller.getEligibleCampaigns');
  }
};

const getSubmissionRequirementsController = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = await getSubmissionRequirements(req.user._id, campaignId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error, 'submissionEligibility.controller.getSubmissionRequirements');
  }
};

module.exports = { 
    getEligibleCampaignsController,
    getSubmissionRequirementsController,
};