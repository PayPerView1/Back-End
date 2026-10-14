// src/services/notification/notificationEmails.js
// كل رسائل البريد الجديدة في سبرنت 4، في ملف واحد بدل emailService.js
// حتى لا يتعارض الشخصان على module.exports (emailService نفسه لم نغيّره).
//
// كل الدوال ترجع Promise وقد ترفض عند فشل SendGrid — استعملها دائماً داخل
// emailFn الذي يُمرَّر لـ notifyUser/notifyAdmins (يبتلع الأخطاء)، أو داخل try/catch.
const { sendEmail } = require('../emailService');

// sendEmail يضع message داخل HTML مباشرة، فأي نص من المستخدم يجب تهريبه
const escapeHtml = (value) =>
  String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ----------------------
// الإبلاغ والإشراف
// ----------------------

/** للمعلن: حملته أُوقفت بسبب بلاغ */
const sendCampaignReportedEmail = (advertiser, { campaignName }) =>
  sendEmail({
    email: advertiser.email,
    subject: 'Your campaign has been paused for review',
    message: `Your campaign "<b>${escapeHtml(campaignName)}</b>" has been paused because of a report. It will be reviewed within 24 hours. We will notify you of the outcome.`,
  });

/** لفريق المراجعة (بريد واحد إلى MODERATION_TEAM_EMAIL) — يُتجاهل إن لم يُضبط المتغير */
const sendReportReceivedAdminEmail = ({ campaignName, reason, reportId }) => {
  const to = process.env.MODERATION_TEAM_EMAIL;
  if (!to) return Promise.resolve(null);

  return sendEmail({
    email: to,
    subject: 'New campaign report to review',
    message: `A new report was submitted.<br/>Campaign: <b>${escapeHtml(campaignName)}</b><br/>Reason: ${escapeHtml(reason)}<br/>Report ID: ${escapeHtml(reportId)}`,
  });
};

/** لزائر: رابط تأكيد البلاغ (confirmUrl يبنيه report.service من FRONTEND_URL + token) */
const sendReportConfirmationEmail = (email, { campaignName, confirmUrl }) =>
  sendEmail({
    email,
    subject: 'Please confirm your report',
    message: `We received your report about the campaign "<b>${escapeHtml(campaignName)}</b>". Please confirm it by opening this link (valid for 48 hours):<br/><a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a><br/>If you did not submit this report, ignore this email.`,
  });

/** لمقدّم البلاغ: نتيجة المراجعة. outcome: 'CONFIRMED' | 'DISMISSED' */
const sendReportOutcomeEmail = (email, { campaignName, outcome }) =>
  sendEmail({
    email,
    subject: 'Your report has been reviewed',
    message:
      outcome === 'CONFIRMED'
        ? `Thank you. We reviewed your report and confirmed a violation in the campaign "<b>${escapeHtml(campaignName)}</b>". The campaign has been cancelled.`
        : `We reviewed your report about the campaign "<b>${escapeHtml(campaignName)}</b>" and found no violation.`,
  });

/** للمعلن: الحملة أُلغيت بعد تأكيد مخالفة (note = سبب الإلغاء من الأدمن) */
const sendCampaignCancelledByReportEmail = (advertiser, { campaignName, note }) =>
  sendEmail({
    email: advertiser.email,
    subject: 'Your campaign has been cancelled',
    message: `Your campaign "<b>${escapeHtml(campaignName)}</b>" was cancelled after a policy violation was confirmed.<br/>Reason: ${escapeHtml(note)}<br/>Any unspent campaign budget has been returned to your wallet.`,
  });

/** للمعلن: لا مخالفة، الحملة عادت للظهور */
const sendCampaignSuspensionLiftedEmail = (advertiser, { campaignName }) =>
  sendEmail({
    email: advertiser.email,
    subject: 'Your campaign is live again',
    message: `The review of your campaign "<b>${escapeHtml(campaignName)}</b>" found no violation. It is visible to creators again.`,
  });

// ----------------------
// التقديم
// ----------------------

/** للمعلن: متقدم جديد */
const sendNewApplicantEmail = (advertiser, { campaignName, creatorName }) =>
  sendEmail({
    email: advertiser.email,
    subject: 'New applicant on your campaign',
    message: `<b>${escapeHtml(creatorName)}</b> applied to your campaign "<b>${escapeHtml(campaignName)}</b>". Review the application from your campaign page.`,
  });

/** للمبدع: قُبل طلبه */
const sendApplicationAcceptedEmail = (creator, { campaignName }) =>
  sendEmail({
    email: creator.email,
    subject: 'Your application has been accepted',
    message: `Your application for the campaign "<b>${escapeHtml(campaignName)}</b>" has been accepted. You can now download the materials and get started.`,
  });

/** للمبدع: رُفض طلبه */
const sendApplicationRejectedEmail = (creator, { campaignName }) =>
  sendEmail({
    email: creator.email,
    subject: 'Update on your application',
    message: `We regret to inform you that your application for the campaign "<b>${escapeHtml(campaignName)}</b>" has been rejected.`,
  });

module.exports = {
  sendCampaignReportedEmail,
  sendReportReceivedAdminEmail,
  sendReportConfirmationEmail,
  sendReportOutcomeEmail,
  sendCampaignCancelledByReportEmail,
  sendCampaignSuspensionLiftedEmail,
  sendNewApplicantEmail,
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
};