// src/utils/submission/submissionGuards.utils.js
// حراس مشتركة بين التنزيل والتسليم والأهلية: يجب أن يستعملها الجميع بدل إعادة كتابتها،
// حتى لا يختلف سلوك "من يحق له؟" بين الميزات.
//
// التوقيعات المتفق عليها:
//   getAcceptedApplication(creatorId, { applicationId | campaignId }) -> application (lean) أو يرمي
//   isOpenForSubmissions(campaign)                                    -> boolean
//   assertCampaignOpenForSubmissions(campaign)                        -> يرمي CAMPAIGN_UNAVAILABLE
//   getSubmissionLimit(campaign)                                      -> number
//   countActiveSubmissions(creatorId, campaignId)                     -> number
//   assertWithinSubmissionLimit(creatorId, campaign)                  -> يرمي SUBMISSION_LIMIT_REACHED
const Application = require('../../models/application');
const Submission = require('../../models/submission');
const { AppError } = require('../errors');
const { APPLICATION_STATUS } = require('../../constants/discovery.constants');
const { LINK_HOLDING_STATUSES, SUBMISSION_CONFIG } = require('../../constants/submission.constants');
const { isOpenForApplications } = require('../campaign/campaignVisibility.utils');

/**
 * يجلب طلب المبدع المقبول.
 *  - بالـ applicationId: NOT_FOUND إن لم يوجد أو كان لمبدع آخر (لا نكشف وجوده).
 *  - بالـ campaignId: APPLICATION_NOT_ACCEPTED إن لم يوجد طلب مقبول.
 *  - طلب موجود لكن غير مقبول: APPLICATION_NOT_ACCEPTED.
 */
const getAcceptedApplication = async (creatorId, { applicationId, campaignId } = {}) => {
  const filter = { creatorId };
  if (applicationId) filter._id = applicationId;
  else if (campaignId) filter.campaignId = campaignId;
  else throw new AppError('applicationId or campaignId is required', 'VALIDATION_ERROR');

  const application = await Application.findOne(filter).lean();

  if (!application) {
    if (applicationId) throw new AppError('Application not found', 'NOT_FOUND');
    throw new AppError('You are not accepted into this campaign.', 'APPLICATION_NOT_ACCEPTED');
  }
  if (application.status !== APPLICATION_STATUS.ACCEPTED) {
    throw new AppError('You are not accepted into this campaign.', 'APPLICATION_NOT_ACCEPTED');
  }
  return application;
};

/** نفس شروط "فتح التقديم": ظاهرة، غير موقوفة، لم تنتهِ، فيها ميزانية، ACTIVE أو متوقفة بسبب الحد اليومي فقط */
const isOpenForSubmissions = (campaign, now = new Date()) => isOpenForApplications(campaign, now);

const assertCampaignOpenForSubmissions = (campaign) => {
  if (!isOpenForSubmissions(campaign)) {
    throw new AppError('This campaign is currently unavailable.', 'CAMPAIGN_UNAVAILABLE');
  }
};

const getSubmissionLimit = (campaign) =>
  (campaign && campaign.maxSubmissionsPerCreator) || SUBMISSION_CONFIG.MAX_ACTIVE_PER_CREATOR_PER_CAMPAIGN;

const countActiveSubmissions = (creatorId, campaignId) =>
  Submission.countDocuments({ creatorId, campaignId, status: { $in: LINK_HOLDING_STATUSES } });

const assertWithinSubmissionLimit = async (creatorId, campaign) => {
  const [active, limit] = [await countActiveSubmissions(creatorId, campaign._id), getSubmissionLimit(campaign)];
  if (active >= limit) {
    throw new AppError(
      'You reached the maximum number of active submissions for this campaign.',
      'SUBMISSION_LIMIT_REACHED',
      undefined,
      { active, limit }
    );
  }
  return { active, limit };
};

module.exports = {
  getAcceptedApplication,
  isOpenForSubmissions,
  assertCampaignOpenForSubmissions,
  getSubmissionLimit,
  countActiveSubmissions,
  assertWithinSubmissionLimit,
};