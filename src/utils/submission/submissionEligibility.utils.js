// src/utils/submission/submissionEligibility.utils.js
// تصنيف حملة بالنسبة لمبدع مقبول فيها: هل تظهر في "اختر الحملة لتسليمها"؟ جاهزة؟ تنتهي قريباً؟ ولماذا غير متاحة؟
// نقي (بدون قاعدة بيانات) ليُختبر كاملاً.
//
// classifyEligibility(campaign, { activeCount, now, endingSoonHours }) -> {
//   eligible, availability, unavailableReason, isReady, isEndingSoon, hoursLeft, badges, active, limit }
//   eligible=false => الحملة لا تظهر أبداً (حتى في تبويب "الكل")
// matchesTab(classification, tab)  -> boolean
// countTabs(classifications)       -> { all, ready, endingSoon }
// buildCampaignCode(campaignId)    -> 'PPV-192A3B' (للعرض فقط)
//
// القواعد (متسقة مع Sprint 4 و verifyPost):
//  - لا تظهر: موقوفة بسبب بلاغ، مؤرشفة، غير مموّلة، انتهى تاريخها، أو حالتها ليست ACTIVE / PAUSED / MANUALLY_PAUSED.
//  - "جاهزة" = نفس شرط isOpenForApplications (الذي يعتمد عليه verifyPost) + لم تبلغ حد التسليمات.
//  - متوقفة بسبب الحد اليومي = جاهزة (تُستأنف منتصف الليل UTC).
const { CAMPAIGN_STATUS, PAUSE_REASON } = require('../../constants/campaign.constants');
const { ELIGIBLE_TAB, SUBMISSION_CONFIG } = require('../../constants/submission.constants');
const { isOpenForApplications } = require('../campaign/campaignVisibility.utils');

const HOUR_MS = 60 * 60 * 1000;

const LISTABLE_STATUSES = [
  CAMPAIGN_STATUS.ACTIVE,
  CAMPAIGN_STATUS.PAUSED,
  CAMPAIGN_STATUS.MANUALLY_PAUSED,
];

const UNAVAILABLE_REASON = {
  CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
  SUBMISSION_LIMIT_REACHED: 'SUBMISSION_LIMIT_REACHED',
};

// ⚠️ نفس منطق getSubmissionLimit في submissionGuards (مكرر هنا ليبقى هذا الملف بلا اعتماد على قاعدة البيانات)
const limitFor = (campaign) =>
  campaign.maxSubmissionsPerCreator || SUBMISSION_CONFIG.MAX_ACTIVE_PER_CREATOR_PER_CAMPAIGN;

const hiddenResult = (activeCount, limit) => ({
  eligible: false,
  availability: 'UNAVAILABLE',
  unavailableReason: null,
  isReady: false,
  isEndingSoon: false,
  hoursLeft: null,
  badges: [],
  active: activeCount,
  limit,
});

/** سبب عدم الإتاحة عندما لا تكون الحملة مفتوحة للتسليم (الحملة ظاهرة أصلاً) */
const reasonWhenClosed = (campaign) => {
  const pausedByHand = campaign.status === CAMPAIGN_STATUS.MANUALLY_PAUSED;
  const pausedForOther =
    campaign.status === CAMPAIGN_STATUS.PAUSED &&
    campaign.pauseReason !== PAUSE_REASON.DAILY_LIMIT_REACHED &&
    campaign.pauseReason !== PAUSE_REASON.BUDGET_EXHAUSTED;

  if (pausedByHand || pausedForOther) return UNAVAILABLE_REASON.CAMPAIGN_PAUSED;
  if ((campaign.remainingBudget || 0) <= 0 || campaign.pauseReason === PAUSE_REASON.BUDGET_EXHAUSTED) {
    return UNAVAILABLE_REASON.BUDGET_EXHAUSTED;
  }
  return UNAVAILABLE_REASON.CAMPAIGN_PAUSED;
};

const classifyEligibility = (
  campaign,
  { activeCount = 0, now = new Date(), endingSoonHours = SUBMISSION_CONFIG.ENDING_SOON_HOURS } = {}
) => {
  const limit = limitFor(campaign);
  const endDate = campaign.endDate ? new Date(campaign.endDate) : null;

  const hidden =
    campaign.isSuspended === true ||
    campaign.isArchived === true ||
    !campaign.walletId ||
    (!!endDate && endDate <= now) ||
    !LISTABLE_STATUSES.includes(campaign.status);

  if (hidden) return hiddenResult(activeCount, limit);

  let unavailableReason = null;
  if (!isOpenForApplications(campaign, now)) {
    unavailableReason = reasonWhenClosed(campaign);
  } else if (activeCount >= limit) {
    unavailableReason = UNAVAILABLE_REASON.SUBMISSION_LIMIT_REACHED;
  }

  const hoursLeft = endDate ? Math.max(0, Math.ceil((endDate - now) / HOUR_MS)) : null;
  const isReady = unavailableReason === null;
  const isEndingSoon = isReady && hoursLeft !== null && hoursLeft <= endingSoonHours;

  return {
    eligible: true,
    availability: isReady ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableReason,
    isReady,
    isEndingSoon,
    hoursLeft,
    badges: [...(isReady ? ['READY'] : []), ...(isEndingSoon ? ['ENDING_SOON'] : [])],
    active: activeCount,
    limit,
  };
};

const matchesTab = (classification, tab) => {
  switch (tab) {
    case ELIGIBLE_TAB.READY:
      return classification.isReady;
    case ELIGIBLE_TAB.ENDING_SOON:
      return classification.isEndingSoon;
    default: // ALL
      return classification.eligible;
  }
};

const countTabs = (classifications) => ({
  all: classifications.filter((c) => matchesTab(c, ELIGIBLE_TAB.ALL)).length,
  ready: classifications.filter((c) => matchesTab(c, ELIGIBLE_TAB.READY)).length,
  endingSoon: classifications.filter((c) => matchesTab(c, ELIGIBLE_TAB.ENDING_SOON)).length,
});

const buildCampaignCode = (campaignId) => `PPV-${String(campaignId).slice(-6).toUpperCase()}`;

module.exports = {
  LISTABLE_STATUSES,
  UNAVAILABLE_REASON,
  classifyEligibility,
  matchesTab,
  countTabs,
  buildCampaignCode,
};