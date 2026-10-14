// src/utils/campaign/campaignVisibility.utils.js
// المرجع الوحيد لقواعد "ظهور الحملة للمبدعين" و"إمكانية التقديم".
// يستعمله: Discover, Details, Apply, Report, Recommendations.
const {
  CAMPAIGN_STATUS,
  PAUSE_REASON,
} = require('../../constants/campaign.constants');

// حملات PAUSED التي تظهر للمبدع (بدل أن تختفي):
//  - BUDGET_EXHAUSTED     → تظهر بشارة "Unavailable" ولا يمكن التقديم
//  - DAILY_LIMIT_REACHED  → تظهر ويمكن التقديم (ستُستأنف منتصف الليل)
const VISIBLE_PAUSE_REASONS = [
  PAUSE_REASON.BUDGET_EXHAUSTED,
  PAUSE_REASON.DAILY_LIMIT_REACHED,
];

/**
 * فلتر MongoDB للحملات الظاهرة في Discover.
 * ⚠️ نستخدم { $ne: true } وليس { false } لأن الحملات القديمة (قبل سبرنت 4)
 * لا تحتوي الحقل isSuspended أصلاً، و{ isSuspended: false } لن يطابقها.
 */
const buildVisibleCampaignFilter = (now = new Date()) => ({
  isSuspended: { $ne: true },
  isArchived: { $ne: true },
  // [Funding fix] لا تظهر حملة لم تُموَّل (لم تُخصم ميزانيتها من المحفظة بعد).
  // { $ne: null } يستثني الحقل الفارغ أو غير الموجود.
  walletId: { $ne: null },
  $and: [
    {
      $or: [
        { status: CAMPAIGN_STATUS.ACTIVE },
        {
          status: CAMPAIGN_STATUS.PAUSED,
          pauseReason: { $in: VISIBLE_PAUSE_REASONS },
        },
      ],
    },
    // endDate فارغ (أو غير موجود) = بلا تاريخ انتهاء
    { $or: [{ endDate: null }, { endDate: { $gt: now } }] },
  ],
});

const hasEnded = (campaign, now = new Date()) =>
  !!campaign.endDate && new Date(campaign.endDate) <= now;

/** هل الحملة ظاهرة للمبدع (متاحة أو "Unavailable")؟ نسخة مفردة من الفلتر أعلاه */
const isPubliclyVisible = (campaign, now = new Date()) => {
  if (!campaign) return false;
  if (!campaign.walletId) return false; // [Funding fix] غير مموّلة
  if (campaign.isSuspended === true || campaign.isArchived === true) return false;
  if (hasEnded(campaign, now)) return false;
  if (campaign.status === CAMPAIGN_STATUS.ACTIVE) return true;

  return (
    campaign.status === CAMPAIGN_STATUS.PAUSED &&
    VISIBLE_PAUSE_REASONS.includes(campaign.pauseReason)
  );
};

/**
 * هل يمكن للمبدع التقديم على الحملة الآن؟
 * (لا يشمل حد المتقدمين وشروط المبدع — تُفحص في application.service)
 */
const isOpenForApplications = (campaign, now = new Date()) => {
  if (!isPubliclyVisible(campaign, now)) return false;
  if ((campaign.remainingBudget || 0) <= 0) return false;

  if (campaign.status === CAMPAIGN_STATUS.ACTIVE) return true;
  return campaign.pauseReason === PAUSE_REASON.DAILY_LIMIT_REACHED;
};

/** 'AVAILABLE' | 'UNAVAILABLE' — للعرض في بطاقة الحملة */
const getAvailability = (campaign, now = new Date()) =>
  isOpenForApplications(campaign, now) ? 'AVAILABLE' : 'UNAVAILABLE';

/**
 * هل يمكن الإبلاغ عن الحملة؟
 * نسمح بالإبلاغ حتى لو أُوقفت مؤخراً (بلاغ إضافي يُسجَّل بدون إعادة إيقاف).
 */
const REPORTABLE_STATUSES = [
  CAMPAIGN_STATUS.ACTIVE,
  CAMPAIGN_STATUS.PAUSED,
  CAMPAIGN_STATUS.MANUALLY_PAUSED,
];

const isReportable = (campaign) =>
  !!campaign &&
  campaign.isArchived !== true &&
  REPORTABLE_STATUSES.includes(campaign.status);

module.exports = {
  VISIBLE_PAUSE_REASONS,
  REPORTABLE_STATUSES,
  buildVisibleCampaignFilter,
  isPubliclyVisible,
  isOpenForApplications,
  getAvailability,
  isReportable,
};