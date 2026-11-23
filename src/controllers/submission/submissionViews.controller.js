const submissionViewsService = require('../../services/submission/submissionViews.service');
const { sendError } = require('../../utils/errors');

const getSubmissionViews = async (req, res) => {
  try {
    const data = await submissionViewsService.getSubmissionViews(
      req.validated.params.id,
      req.user._id,
      req.validated.query
    );
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, 'submissionViews.getSubmissionViews');
  }
};

const getCampaignAnalytics = async (req, res) => {
  try {
    const data = await submissionViewsService.getCampaignAnalytics(
      req.validated.params.campaignId,
      req.user._id
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'submissionViews.getCampaignAnalytics');
  }
};

const listReviewQueue = async (req, res) => {
  try {
    const data = await submissionViewsService.listReviewQueue(req.validated.query);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, 'submissionViews.listReviewQueue');
  }
};

const reviewSnapshot = async (req, res) => {
  try {
    const data = await submissionViewsService.reviewSnapshot(
      req.validated.params.id,
      req.user._id,
      req.validated.body
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'submissionViews.reviewSnapshot');
  }
};

module.exports = { getSubmissionViews, getCampaignAnalytics, listReviewQueue, reviewSnapshot };
