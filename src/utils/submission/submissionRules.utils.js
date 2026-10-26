// src/utils/submission/submissionRules.utils.js
// تقييم متطلبات الحملة (هاشتاقات، كلمات، منشن، مدة) على بيانات المنشور. نقي، بدون قاعدة بيانات.
//
// التوقيعات المتفق عليها:
//   evaluateRequirements({ requirements, postMeta }) -> { checks, view, allMet, canSubmit, hasBlocking, blocking, verifiable, warnings }
//   isPlatformAllowed(requirements, platform)        -> boolean
//   buildRequirementsView(campaign)                  -> كائن SubmissionRequirements للـ API (بالبادئات # و @)
//   toBackendChecksPayload(checks)                   -> [{ code, status }] لإرسالها لخدمة الـ AI
//
// requirements = campaign.submissionRequirements (القيم مخزّنة بدون # و @)
// postMeta     = نفس شكل Submission.postMeta (fetchStatus, caption, durationSec ...)
const {
  CHECK_CODE,
  CHECK_SOURCE,
  CHECK_STATUS,
  POST_FETCH_STATUS,
} = require('../../constants/submission.constants');
const {
  normalizeText,
  extractHashtags,
  extractMentions,
  hasTag,
  hasMention,
  toDisplayTag,
  toDisplayMention,
} = require('./hashtag.utils');

const DURATION_TOLERANCE_SEC = 1;

const asList = (value) => (Array.isArray(value) ? value : []);

const makeCheck = (code, status, message, fixHint, meta) => ({
  code,
  source: CHECK_SOURCE.RULES,
  status,
  message,
  fixHint,
  score: null,
  meta,
});

const isPlatformAllowed = (requirements, platform) => {
  const allowed = asList(requirements && requirements.platforms);
  return allowed.length === 0 || allowed.includes(platform);
};

const evaluateRequirements = ({ requirements = {}, postMeta = null } = {}) => {
  const reqHashtags = asList(requirements.requiredHashtags);
  const reqKeywords = asList(requirements.requiredKeywords);
  const reqMentions = asList(requirements.requiredMentions);
  const minSec = requirements.minDurationSec || null;
  const maxSec = requirements.maxDurationSec || null;

  const verifiable = !!postMeta && postMeta.fetchStatus === POST_FETCH_STATUS.OK;
  const caption = verifiable ? postMeta.caption || '' : '';
  const captionTags = verifiable ? extractHashtags(caption) : [];
  const captionMentions = verifiable ? extractMentions(caption) : [];
  const captionText = normalizeText(caption);

  const view = { hashtags: [], keywords: [], mentions: [], duration: null, allMet: null };
  const checks = [];
  const blocking = { missingHashtags: [], missingKeywords: [], missingMentions: [], duration: null };

  const unreadable = 'Could not read the post text, it will be checked by the review';

  // --- الهاشتاقات ---
  if (reqHashtags.length) {
    view.hashtags = reqHashtags.map((tag) => ({
      tag: toDisplayTag(tag),
      found: verifiable ? hasTag(captionTags, tag) : null,
    }));
    blocking.missingHashtags = view.hashtags.filter((h) => h.found === false).map((h) => h.tag);
    const found = view.hashtags.filter((h) => h.found === true).map((h) => h.tag);

    if (!verifiable) {
      checks.push(makeCheck(CHECK_CODE.REQUIRED_HASHTAGS, CHECK_STATUS.NEEDS_REVIEW, unreadable, '', null));
    } else if (blocking.missingHashtags.length) {
      checks.push(
        makeCheck(
          CHECK_CODE.REQUIRED_HASHTAGS,
          CHECK_STATUS.FAILED,
          `Missing hashtags: ${blocking.missingHashtags.join(' ')}`,
          'Add the missing hashtags to the post description',
          { found, missing: blocking.missingHashtags }
        )
      );
    } else {
      checks.push(makeCheck(CHECK_CODE.REQUIRED_HASHTAGS, CHECK_STATUS.PASSED, '', '', { found, missing: [] }));
    }
  }

  // --- الكلمات المفتاحية ---
  if (reqKeywords.length) {
    view.keywords = reqKeywords.map((keyword) => ({
      keyword,
      found: verifiable ? captionText.includes(normalizeText(keyword)) : null,
    }));
    blocking.missingKeywords = view.keywords.filter((k) => k.found === false).map((k) => k.keyword);
    const found = view.keywords.filter((k) => k.found === true).map((k) => k.keyword);

    if (!verifiable) {
      checks.push(makeCheck(CHECK_CODE.REQUIRED_KEYWORDS, CHECK_STATUS.NEEDS_REVIEW, unreadable, '', null));
    } else if (blocking.missingKeywords.length) {
      checks.push(
        makeCheck(
          CHECK_CODE.REQUIRED_KEYWORDS,
          CHECK_STATUS.FAILED,
          `Missing keywords: ${blocking.missingKeywords.join(', ')}`,
          'Mention the required keywords in the post description',
          { found, missing: blocking.missingKeywords }
        )
      );
    } else {
      checks.push(makeCheck(CHECK_CODE.REQUIRED_KEYWORDS, CHECK_STATUS.PASSED, '', '', { found, missing: [] }));
    }
  }

  // --- المنشن (حساب المعلن) ---
  if (reqMentions.length) {
    view.mentions = reqMentions.map((mention) => ({
      mention: toDisplayMention(mention),
      found: verifiable ? hasMention(captionMentions, mention) : null,
    }));
    blocking.missingMentions = view.mentions.filter((m) => m.found === false).map((m) => m.mention);
    const found = view.mentions.filter((m) => m.found === true).map((m) => m.mention);

    if (!verifiable) {
      checks.push(makeCheck(CHECK_CODE.OFFICIAL_MENTION, CHECK_STATUS.NEEDS_REVIEW, unreadable, '', null));
    } else if (blocking.missingMentions.length) {
      checks.push(
        makeCheck(
          CHECK_CODE.OFFICIAL_MENTION,
          CHECK_STATUS.FAILED,
          `Missing mention: ${blocking.missingMentions.join(' ')}`,
          'Tag the official account in the post description',
          { found, missing: blocking.missingMentions }
        )
      );
    } else {
      checks.push(makeCheck(CHECK_CODE.OFFICIAL_MENTION, CHECK_STATUS.PASSED, '', '', { found, missing: [] }));
    }
  }

  // --- المدة (تُحجب فقط عندما تكون معروفة وخارج النطاق) ---
  if (minSec || maxSec) {
    const actual = postMeta && Number.isFinite(postMeta.durationSec) ? postMeta.durationSec : null;
    let ok = null;
    if (actual !== null) {
      ok =
        (!minSec || actual >= minSec - DURATION_TOLERANCE_SEC) &&
        (!maxSec || actual <= maxSec + DURATION_TOLERANCE_SEC);
    }
    view.duration = { ok, actualSec: actual, min: minSec, max: maxSec };
    if (ok === false) blocking.duration = { actualSec: actual, min: minSec, max: maxSec };

    const meta = { actualSec: actual, min: minSec, max: maxSec };
    if (ok === null) {
      checks.push(makeCheck(CHECK_CODE.DURATION, CHECK_STATUS.SKIPPED, 'Duration is not available', '', meta));
    } else if (ok) {
      checks.push(makeCheck(CHECK_CODE.DURATION, CHECK_STATUS.PASSED, '', '', meta));
    } else {
      checks.push(
        makeCheck(
          CHECK_CODE.DURATION,
          CHECK_STATUS.FAILED,
          `Video length is ${actual}s, required ${minSec || 0}-${maxSec || '∞'}s`,
          'Re-edit the clip to fit the required length',
          meta
        )
      );
    }
  }

  const hasBlocking =
    blocking.missingHashtags.length > 0 ||
    blocking.missingKeywords.length > 0 ||
    blocking.missingMentions.length > 0 ||
    blocking.duration !== null;

  const anythingRequired = reqHashtags.length > 0 || reqKeywords.length > 0 || reqMentions.length > 0;
  const warnings = !verifiable && anythingRequired ? ['CONTENT_NOT_VERIFIABLE'] : [];

  // allMet: false = ينقص شيء، true = كل شيء متوفر، null = لا يمكن الجزم
  let allMet = null;
  if (hasBlocking) allMet = false;
  else if (verifiable || !anythingRequired) allMet = true;
  view.allMet = allMet;

  return {
    checks,
    view,
    allMet,
    canSubmit: !hasBlocking,
    hasBlocking,
    blocking,
    verifiable,
    warnings,
  };
};

const buildRequirementsView = (campaign) => {
  const r = (campaign && campaign.submissionRequirements) || {};
  const min = r.minDurationSec || null;
  const max = r.maxDurationSec || null;

  return {
    platforms: asList(r.platforms),
    aspectRatio: r.aspectRatio || '9:16',
    durationRange: min || max ? { min, max } : null,
    requiredHashtags: asList(r.requiredHashtags).map(toDisplayTag),
    requiredKeywords: asList(r.requiredKeywords),
    requiredMentions: asList(r.requiredMentions).map(toDisplayMention),
    shariaNote: r.shariaNote || '',
    offerCondition: r.offerCondition || '',
    clipIdea: r.clipIdea || '',
  };
};

const toBackendChecksPayload = (checks) =>
  asList(checks).map(({ code, status }) => ({ code, status }));

module.exports = {
  DURATION_TOLERANCE_SEC,
  evaluateRequirements,
  isPlatformAllowed,
  buildRequirementsView,
  toBackendChecksPayload,
};