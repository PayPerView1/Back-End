// src/services/submission/submissionNotifications.service.js
// كل إشعارات وبريد سبرنت 5 في مكان واحد. القواعد (نفس عقد notification.service):
//   - كل الدوال لا ترمي أخطاء أبداً (فشل إشعار لا يفشّل التسليم).
//   - تُستدعى بعد الـ commit وليس داخل transaction.
//   - تستقبل كائنات lean: submission { _id, creatorId, rejectionReasons? }, campaign { _id, name, advertiserId }
//
// التوقيعات المتفق عليها (كلها async):
//   notifyBrandNewSubmission(submission, campaign)
//   notifyCreatorAiApproved(submission, campaign)
//   notifyCreatorAiRejected(submission, campaign)
//   notifyCreatorManualReview(submission, campaign)
//   notifyAdminsManualReview(submission, campaign, reasonCode)
//   notifyCreatorApproved(submission, campaign, { auto })
//   notifyCreatorRejected(submission, campaign, { note })
//   notifyDownloadResult(log, campaign, outcome)   // outcome: 'COMPLETED' | 'FAILED'
const User = require('../../models/user');
const { notifyUser, notifyAdmins } = require('../notification/notification.service');
const { buildNotification } = require('../notification/notification.templates');
const notificationEmails = require('../notification/notificationEmails');
const { NOTIFICATION_TYPE } = require('../../constants/discovery.constants');

const loadUser = (id) => User.findById(id).select('email fullName').lean();

// يلف الدالة بحيث لا ترمي أبداً
const safe = (name, fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error(`[submissionNotifications] ${name} failed: ${error.message}`);
    return null;
  }
};

const ids = (submission, campaign) => ({
  campaignId: String(campaign._id),
  submissionId: String(submission._id),
});

const notifyBrandNewSubmission = safe('notifyBrandNewSubmission', async (submission, campaign) => {
  const [advertiser, creator] = await Promise.all([
    loadUser(campaign.advertiserId),
    loadUser(submission.creatorId),
  ]);
  if (!advertiser) return null;

  const params = { campaignName: campaign.name, creatorName: creator && creator.fullName };
  return notifyUser(
    advertiser._id,
    buildNotification(NOTIFICATION_TYPE.NEW_SUBMISSION, params, ids(submission, campaign)),
    () => notificationEmails.sendNewSubmissionEmail(advertiser, params)
  );
});

const notifyCreatorAiApproved = safe('notifyCreatorAiApproved', async (submission, campaign) =>
  notifyUser(
    submission.creatorId,
    buildNotification(NOTIFICATION_TYPE.SUBMISSION_AI_APPROVED, { campaignName: campaign.name }, ids(submission, campaign))
  )
);

const notifyCreatorAiRejected = safe('notifyCreatorAiRejected', async (submission, campaign) => {
  const creator = await loadUser(submission.creatorId);
  const reasons = submission.rejectionReasons || [];
  const params = { campaignName: campaign.name, reason: reasons[0] && reasons[0].message };

  return notifyUser(
    submission.creatorId,
    buildNotification(NOTIFICATION_TYPE.SUBMISSION_AI_REJECTED, params, ids(submission, campaign)),
    creator ? () => notificationEmails.sendSubmissionAiRejectedEmail(creator, params) : undefined
  );
});

const notifyCreatorManualReview = safe('notifyCreatorManualReview', async (submission, campaign) =>
  notifyUser(
    submission.creatorId,
    buildNotification(NOTIFICATION_TYPE.SUBMISSION_MANUAL_REVIEW, { campaignName: campaign.name }, ids(submission, campaign))
  )
);

const notifyAdminsManualReview = safe('notifyAdminsManualReview', async (submission, campaign, reasonCode) =>
  notifyAdmins(
    buildNotification(
      NOTIFICATION_TYPE.MANUAL_REVIEW_REQUIRED,
      { campaignName: campaign.name, reasonCode },
      { ...ids(submission, campaign), reasonCode: reasonCode || null }
    ),
    () =>
      notificationEmails.sendManualReviewAdminEmail({
        campaignName: campaign.name,
        reasonCode,
        submissionId: String(submission._id),
      })
  )
);

const notifyCreatorApproved = safe('notifyCreatorApproved', async (submission, campaign, { auto = false } = {}) => {
  const creator = await loadUser(submission.creatorId);
  const params = { campaignName: campaign.name, auto };

  return notifyUser(
    submission.creatorId,
    buildNotification(NOTIFICATION_TYPE.SUBMISSION_APPROVED, params, { ...ids(submission, campaign), auto }),
    creator ? () => notificationEmails.sendSubmissionApprovedEmail(creator, params) : undefined
  );
});

const notifyCreatorRejected = safe('notifyCreatorRejected', async (submission, campaign, { note } = {}) => {
  const creator = await loadUser(submission.creatorId);
  const params = { campaignName: campaign.name, note };

  return notifyUser(
    submission.creatorId,
    buildNotification(NOTIFICATION_TYPE.SUBMISSION_REJECTED, params, ids(submission, campaign)),
    creator ? () => notificationEmails.sendSubmissionRejectedEmail(creator, params) : undefined
  );
});

const notifyDownloadResult = safe('notifyDownloadResult', async (log, campaign, outcome) => {
  const type =
    outcome === 'COMPLETED' ? NOTIFICATION_TYPE.DOWNLOAD_COMPLETED : NOTIFICATION_TYPE.DOWNLOAD_FAILED;

  return notifyUser(
    log.creatorId,
    buildNotification(type, { campaignName: campaign.name }, { campaignId: String(campaign._id), logId: String(log._id) })
  );
});

// ----------------------
// Sprint 5 — التسليم
// ----------------------

/** للمعلن: محتوى جاهز لقراره */
const sendNewSubmissionEmail = (advertiser, { campaignName, creatorName }) =>
  sendEmail({
    email: advertiser.email,
    subject: 'New content ready for your review',
    message: `<b>${escapeHtml(creatorName || 'A creator')}</b> submitted a clip for your campaign "<b>${escapeHtml(campaignName)}</b>". Review it from your campaign page.`,
  });

/** للمبدع: رفضه الفحص الآلي (reason = أول سبب) */
const sendSubmissionAiRejectedEmail = (creator, { campaignName, reason }) =>
  sendEmail({
    email: creator.email,
    subject: 'Your clip needs changes',
    message: `Your clip for the campaign "<b>${escapeHtml(campaignName)}</b>" does not meet the requirements.${
      reason ? `<br/>${escapeHtml(reason)}` : ''
    }<br/>Fix the post and submit it again from your dashboard.`,
  });

/** للمبدع: اعتُمد التسليم (auto = اعتماد تلقائي) */
const sendSubmissionApprovedEmail = (creator, { campaignName, auto }) =>
  sendEmail({
    email: creator.email,
    subject: 'Your clip has been approved',
    message: `Your clip for the campaign "<b>${escapeHtml(campaignName)}</b>" ${
      auto ? 'was approved automatically.' : 'has been approved.'
    }`,
  });

/** للمبدع: رفضه المعلن أو المدقق */
const sendSubmissionRejectedEmail = (creator, { campaignName, note }) =>
  sendEmail({
    email: creator.email,
    subject: 'Update on your clip',
    message: `Your clip for the campaign "<b>${escapeHtml(campaignName)}</b>" was rejected.${
      note ? `<br/>Reason: ${escapeHtml(note)}` : ''
    }`,
  });

/** لفريق المراجعة (بريد واحد إلى MODERATION_TEAM_EMAIL) */
const sendManualReviewAdminEmail = ({ campaignName, reasonCode, submissionId }) => {
  const to = process.env.MODERATION_TEAM_EMAIL;
  if (!to) return Promise.resolve(null);

  return sendEmail({
    email: to,
    subject: 'Submission needs manual review',
    message: `A submission for "<b>${escapeHtml(campaignName)}</b>" needs manual review.<br/>Reason: ${escapeHtml(
      reasonCode || 'N/A'
    )}<br/>Submission ID: ${escapeHtml(submissionId)}`,
  });
};
module.exports = {
  notifyBrandNewSubmission,
  notifyCreatorAiApproved,
  notifyCreatorAiRejected,
  notifyCreatorManualReview,
  notifyAdminsManualReview,
  notifyCreatorApproved,
  notifyCreatorRejected,
  notifyDownloadResult,
  sendNewSubmissionEmail,
  sendSubmissionAiRejectedEmail,
  sendSubmissionApprovedEmail,
  sendSubmissionRejectedEmail,
  sendManualReviewAdminEmail,
};