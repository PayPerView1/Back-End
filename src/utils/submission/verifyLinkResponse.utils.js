// src/utils/submission/verifyLinkResponse.utils.js
// يحوّل ناتج verifyPost إلى data استجابة POST /submissions/verify-link (العقد §4.3).
// نقي (بدون قاعدة بيانات)، ومعزول عن الـ controller ليسهل اختباره.
//
// buildVerifyLinkResponse({ parsed, postMeta, evaluation }) -> data
//   parsed     = { platform, canonicalUrl, externalId }
//   postMeta   = شكل Submission.postMeta (يحوي fetchStatus دائماً)
//   evaluation = ناتج evaluateRequirements: { view, canSubmit, warnings, ... }
//
// قاعدة العرض: preview = null عندما لا تتوفر بيانات المنشور (fetchStatus != OK)،
// فتعرض الواجهة "تعذّر جلب المعاينة" بدل صورة وحقول فارغة.
const { POST_FETCH_STATUS } = require('../../constants/submission.constants');

const buildPreview = (postMeta) => {
  if (!postMeta || postMeta.fetchStatus !== POST_FETCH_STATUS.OK) return null;

  return {
    thumbnailUrl: postMeta.thumbnailUrl || '',
    caption: postMeta.caption || '',
    authorName: postMeta.authorName || '',
    authorHandle: postMeta.authorHandle || '',
    authorUrl: postMeta.authorUrl || '',
    durationSec: postMeta.durationSec === undefined ? null : postMeta.durationSec,
    stats: postMeta.stats || null,
  };
};

const buildVerifyLinkResponse = ({ parsed, postMeta, evaluation }) => ({
  platform: parsed.platform,
  canonicalUrl: parsed.canonicalUrl,
  externalId: parsed.externalId,
  fetchStatus: postMeta.fetchStatus,
  preview: buildPreview(postMeta),
  requirements: evaluation.view,
  canSubmit: evaluation.canSubmit,
  warnings: evaluation.warnings || [],
});

module.exports = { buildVerifyLinkResponse, buildPreview };