// src/services/notification/notification.templates.js
// مصدر واحد لنصوص الإشعارات (الإنجليزية الاحتياطية). الفرونت يترجم حسب type + data.
// ملاحظة للفرونت: النصوص نص عادي (plain text) — لا تعرضوها بـ innerHTML.
//
// الاستخدام:
//   const { buildNotification } = require('./notification.templates');
//   await notifyUser(
//     advertiser._id,
//     buildNotification(NOTIFICATION_TYPE.NEW_APPLICANT,
//       { campaignName: campaign.name },
//       { campaignId: campaign._id, applicationId: application._id }),
//     () => sendNewApplicantEmail(advertiser, { campaignName, creatorName })
//   );
const { NOTIFICATION_TYPE } = require('../../constants/discovery.constants');

const TEMPLATES = {
  [NOTIFICATION_TYPE.CAMPAIGN_REPORTED]: ({ campaignName }) => ({
    title: 'Campaign under review',
    message: `Your campaign "${campaignName}" has been paused because of a report. It will be reviewed within 24 hours.`,
  }),

  [NOTIFICATION_TYPE.REPORT_RECEIVED]: ({ campaignName, reason }) => ({
    title: 'New campaign report',
    message: `A new report (${reason}) was submitted for the campaign "${campaignName}".`,
  }),

  // outcome: 'CONFIRMED' | 'DISMISSED'
  [NOTIFICATION_TYPE.REPORT_RESOLVED]: ({ campaignName, outcome }) => ({
    title: 'Your report was reviewed',
    message:
      outcome === 'CONFIRMED'
        ? `Thank you. We confirmed a violation in "${campaignName}" and the campaign was cancelled.`
        : `We reviewed your report about "${campaignName}" and found no violation.`,
  }),

  [NOTIFICATION_TYPE.CAMPAIGN_CANCELLED_BY_REPORT]: ({ campaignName, note }) => ({
    title: 'Campaign cancelled',
    message: `Your campaign "${campaignName}" was cancelled after a policy violation was confirmed.${
      note ? ` Reason: ${note}` : ''
    }`,
  }),

  [NOTIFICATION_TYPE.CAMPAIGN_SUSPENSION_LIFTED]: ({ campaignName }) => ({
    title: 'Campaign resumed',
    message: `The review of "${campaignName}" found no violation. Your campaign is visible again.`,
  }),

  [NOTIFICATION_TYPE.NEW_APPLICANT]: ({ campaignName, creatorName }) => ({
    title: 'New applicant',
    message: `${creatorName || 'A creator'} applied to your campaign "${campaignName}".`,
  }),

  [NOTIFICATION_TYPE.APPLICATION_ACCEPTED]: ({ campaignName }) => ({
    title: 'Application accepted',
    message: `Your application for "${campaignName}" has been accepted. You can now download the materials and get started.`,
  }),

  [NOTIFICATION_TYPE.APPLICATION_REJECTED]: ({ campaignName }) => ({
    title: 'Application rejected',
    message: `We regret to inform you that your application for "${campaignName}" has been rejected.`,
  }),

  [NOTIFICATION_TYPE.FAVORITE_CAMPAIGN_UNAVAILABLE]: ({ campaignName }) => ({
    title: 'Favorite campaign unavailable',
    message: `The campaign "${campaignName}" in your favorites is no longer available.`,
  }),

  [NOTIFICATION_TYPE.BUDGET_EXHAUSTED]: ({ campaignName }) => ({
    title: 'Campaign budget exhausted',
    message: `Your campaign "${campaignName}" has been paused because its budget is exhausted. Recharge it to continue.`,
  }),
    // ===== Sprint 5 =====
  // للمعلن: محتوى جاهز لقراره
  [NOTIFICATION_TYPE.NEW_SUBMISSION]: ({ campaignName, creatorName }) => ({
    title: 'New content to review',
    message: `${creatorName || 'A creator'} submitted a clip for your campaign "${campaignName}". It is waiting for your decision.`,
  }),

  [NOTIFICATION_TYPE.SUBMISSION_AI_APPROVED]: ({ campaignName }) => ({
    title: 'Clip passed the automatic review',
    message: `Your clip for "${campaignName}" passed the automatic review and is waiting for the advertiser's approval.`,
  }),

  // reason: أول سبب رفض (اختياري)
  [NOTIFICATION_TYPE.SUBMISSION_AI_REJECTED]: ({ campaignName, reason }) => ({
    title: 'Clip needs changes',
    message: `Your clip for "${campaignName}" does not meet the requirements.${
      reason ? ` ${reason}` : ''
    } Fix the post and submit it again.`,
  }),

  [NOTIFICATION_TYPE.SUBMISSION_MANUAL_REVIEW]: ({ campaignName }) => ({
    title: 'Clip under manual review',
    message: `Your clip for "${campaignName}" was sent to our review team. No action is needed from you.`,
  }),

  // للأدمن
  [NOTIFICATION_TYPE.MANUAL_REVIEW_REQUIRED]: ({ campaignName, reasonCode }) => ({
    title: 'Submission needs manual review',
    message: `A submission for "${campaignName}" needs manual review${reasonCode ? ` (${reasonCode})` : ''}.`,
  }),

  // auto = true عند الاعتماد التلقائي
  [NOTIFICATION_TYPE.SUBMISSION_APPROVED]: ({ campaignName, auto }) => ({
    title: 'Clip approved',
    message: auto
      ? `Your clip for "${campaignName}" was approved automatically.`
      : `Your clip for "${campaignName}" has been approved.`,
  }),

  [NOTIFICATION_TYPE.SUBMISSION_REJECTED]: ({ campaignName, note }) => ({
    title: 'Clip rejected',
    message: `Your clip for "${campaignName}" was rejected.${note ? ` Reason: ${note}` : ''}`,
  }),

  [NOTIFICATION_TYPE.DOWNLOAD_COMPLETED]: ({ campaignName }) => ({
    title: 'Download completed',
    message: `The source materials of "${campaignName}" were downloaded successfully.`,
  }),

  [NOTIFICATION_TYPE.DOWNLOAD_FAILED]: ({ campaignName }) => ({
    title: 'Download failed',
    message: `Downloading the source materials of "${campaignName}" failed. Please try again.`,
  }),
};

/**
 * يبني كائن الإشعار الجاهز لـ notifyUser / notifyMany / notifyAdmins.
 * @param {string} type    قيمة من NOTIFICATION_TYPE
 * @param {Object} params  متغيرات النص (campaignName, creatorName, note, outcome, reason)
 * @param {Object} data    معرّفات للتنقل (campaignId, applicationId, ...)
 * @returns {{ type: string, title: string, message: string, data: Object }}
 */
const buildNotification = (type, params = {}, data = {}) => {
  const template = TEMPLATES[type];
  if (!template) {
    throw new Error(`No notification template for type: ${type}`);
  }
  const { title, message } = template(params);
  return { type, title, message, data };
};

module.exports = { buildNotification, TEMPLATES };