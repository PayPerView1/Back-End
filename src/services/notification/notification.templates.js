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