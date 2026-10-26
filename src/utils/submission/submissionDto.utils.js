// src/utils/submission/submissionDto.utils.js
// تحويل مستند Submission (lean أو mongoose) إلى شكل الاستجابة المتفق عليه في العقد.
// المبدع والمعلن والأدمن يستعملون نفس الدوال.
//
// التوقيعات المتفق عليها:
//   toListItem(submission, { campaign, brand } = {})  -> SubmissionListItem
//   toDetail(submission,   { campaign, brand } = {})  -> SubmissionDetail
//
// campaign/brand اختياريان: إن لم يُمرَّرا تُقرأ من submission.campaignId إن كان populated
//   campaignId  = { _id, name, advertiserId: { _id, fullName, profilePicture } | id }
const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');
const {
  SUBMISSION_STATUS,
  ADVERTISER_STATUS,
  DISPLAY_STATUS,
  REJECTED_BY,
  CHECK_STATUS,
  SUBMISSION_CONFIG,
  getDisplayStatus,
  buildSubmissionCode,
} = require('../../constants/submission.constants');
const { toDisplayTag } = require('./hashtag.utils');

const isPopulated = (value) => !!value && typeof value === 'object' && value._id !== undefined && value.name !== undefined;

const resolveCampaign = (submission, ctx) => {
  const campaign = ctx.campaign || (isPopulated(submission.campaignId) ? submission.campaignId : null);
  const id = campaign ? campaign._id : submission.campaignId;

  let brand = ctx.brand || null;
  if (!brand && campaign && campaign.advertiserId && typeof campaign.advertiserId === 'object' && campaign.advertiserId.fullName) {
    brand = campaign.advertiserId;
  }

  return {
    id,
    name: campaign ? campaign.name : null,
    brand: brand
      ? { id: brand._id || brand.id, name: brand.fullName || brand.name, logo: brand.profilePicture || brand.logo || null }
      : null,
  };
};

const toListItem = (submission, ctx = {}) => {
  const displayStatus = getDisplayStatus(submission);
  const aiPending = !submission.aiReview || submission.aiReview.status === AI_REVIEW_RESULT.PENDING;

  return {
    id: submission._id,
    code: buildSubmissionCode(submission),
    campaign: resolveCampaign(submission, ctx),
    platform: submission.platform,
    postUrl: submission.postUrl,
    displayStatus,
    status: submission.status,
    aiScore: aiPending ? null : submission.aiReview.score === undefined ? null : submission.aiReview.score,
    attempt: submission.attempt || 1,
    submittedAt: submission.submittedAt,
    reviewDeadlineAt: [DISPLAY_STATUS.PROCESSING, DISPLAY_STATUS.MANUAL_REVIEW, DISPLAY_STATUS.AWAITING_ADVERTISER].includes(displayStatus)
      ? submission.reviewDeadlineAt || null
      : null,
  };
};

const buildSteps = (submission, displayStatus) => {
  let ai;
  switch (displayStatus) {
    case DISPLAY_STATUS.PROCESSING:
      ai = { state: 'ACTIVE', outcome: null };
      break;
    case DISPLAY_STATUS.MANUAL_REVIEW:
      ai = { state: 'ACTIVE', outcome: 'MANUAL' };
      break;
    case DISPLAY_STATUS.AI_REJECTED:
      ai = { state: 'FAILED', outcome: 'FAILED' };
      break;
    case DISPLAY_STATUS.REJECTED:
      // رفض المدقق اليدوي يعني أن مرحلة الفحص فشلت، ورفض المعلن يعني أنها نجحت
      ai =
        submission.rejectedBy === REJECTED_BY.ADMIN
          ? { state: 'FAILED', outcome: 'FAILED' }
          : { state: 'DONE', outcome: 'PASSED' };
      break;
    case DISPLAY_STATUS.WITHDRAWN:
      ai = { state: 'PENDING', outcome: null };
      break;
    default: // AWAITING_ADVERTISER | APPROVED
      ai = { state: 'DONE', outcome: 'PASSED' };
  }

  let reward = 'PENDING';
  if (displayStatus === DISPLAY_STATUS.APPROVED) reward = 'ACTIVE';
  if ([DISPLAY_STATUS.AI_REJECTED, DISPLAY_STATUS.REJECTED].includes(displayStatus)) reward = 'FAILED';

  return [
    { key: 'SUBMITTED', state: 'DONE' },
    { key: 'AI_REVIEW', state: ai.state, outcome: ai.outcome },
    { key: 'REWARD', state: reward },
  ];
};

const toDetail = (submission, ctx = {}) => {
  const base = toListItem(submission, ctx);
  const displayStatus = base.displayStatus;
  const meta = submission.postMeta || {};
  const checks = (submission.checks || []).map((c) => ({
    code: c.code,
    source: c.source,
    status: c.status,
    message: c.message || '',
    fixHint: c.fixHint || '',
    score: c.score === undefined ? null : c.score,
    meta: c.meta === undefined ? null : c.meta,
  }));

  const count = (status) => checks.filter((c) => c.status === status).length;
  const rejected = [DISPLAY_STATUS.REJECTED, DISPLAY_STATUS.AI_REJECTED].includes(displayStatus);
  const adv = submission.advertiserReview || {};
  const adm = submission.adminReview || {};

  const canWithdraw =
    submission.status === SUBMISSION_STATUS.SUBMITTED ||
    (submission.status === SUBMISSION_STATUS.UNDER_REVIEW &&
      (adv.status === undefined || adv.status === ADVERTISER_STATUS.PENDING));

  return {
    ...base,
    canonicalUrl: submission.canonicalUrl || '',
    preview: {
      thumbnailUrl: meta.thumbnailUrl || '',
      caption: meta.caption || '',
      authorName: meta.authorName || '',
      authorHandle: meta.authorHandle || '',
      authorUrl: meta.authorUrl || '',
      durationSec: meta.durationSec === undefined ? null : meta.durationSec,
      stats: meta.stats || null,
      fetchStatus: meta.fetchStatus || 'UNAVAILABLE',
    },
    hashtags: (submission.hashtags || []).map(toDisplayTag),
    keywords: submission.keywords || [],
    notes: submission.notes || '',
    checks,
    summary: {
      total: checks.length,
      passed: count(CHECK_STATUS.PASSED),
      failed: count(CHECK_STATUS.FAILED),
      needsReview: count(CHECK_STATUS.NEEDS_REVIEW),
    },
    rejectionReasons: submission.rejectionReasons || [],
    rejectedBy: submission.rejectedBy || null,
    reviewNote: rejected ? adv.note || adm.note || null : null,
    steps: buildSteps(submission, displayStatus),
    manualReview:
      displayStatus === DISPLAY_STATUS.MANUAL_REVIEW
        ? {
            expectedHours: {
              min: SUBMISSION_CONFIG.MANUAL_REVIEW_ETA_HOURS.MIN,
              max: SUBMISSION_CONFIG.MANUAL_REVIEW_ETA_HOURS.MAX,
            },
            reasonCode: adm.reasonCode || null,
          }
        : null,
    canWithdraw,
    canUpdateLink: [DISPLAY_STATUS.AWAITING_ADVERTISER, DISPLAY_STATUS.APPROVED].includes(displayStatus),
    canResubmit: rejected,
    resubmissionOf: submission.resubmissionOf || null,
    reward: null, // خارج نطاق سبرنت 5
    reviewedAt: submission.reviewedAt || null,
  };
};

module.exports = { toListItem, toDetail };