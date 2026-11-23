// src/services/campaign/aiReview.service.js
const {
  AI_REVIEW_RESULT,
  CAMPAIGN_STATUS,
  CAMPAIGN_ACTION,
} = require('../../constants/campaign.constants');
const { logActivity } = require('./activityLog.service');
const transport = require('../ai/aiServiceTransport');

// ============================================
// 4.1.2 — تجهيز البيانات المرسلة لخدمة الـ AI
// ============================================
/**
 * @param {Object} campaign - مستند الحملة (Mongoose document أو object عادي)
 * @returns {Object} البيانات يلي رح تنرسل لخدمة الـ AI الخارجية
 */
function buildReviewPayload(campaign) {
  const declaration = campaign.halalDeclaration || {};
  return {
    campaignName: campaign.name,
    brief: campaign.brief,
    targetCountries: campaign.targetCountries,
    halalDeclaration: {
      noGambling: Boolean(declaration.noGambling),
      noSexualContent: Boolean(declaration.noSexualContent),
      noExplicitMusic: Boolean(declaration.noExplicitMusic),
      noAlcohol: Boolean(declaration.noAlcohol),
      noSuspiciousCurrencies: Boolean(declaration.noSuspiciousCurrencies),
      noUnrealisticProfit: Boolean(declaration.noUnrealisticProfit),
    },
  };
}

// ============================================
// 4.1.3 — تحويل نتيجة الـ AI لحالة حملة فعلية
// ============================================
/**
 * @param {string} aiResult - قيمة من AI_REVIEW_RESULT
 * @returns {string} قيمة من CAMPAIGN_STATUS
 */
function mapAIResultToStatus(aiResult) {
  switch (aiResult) {
    case AI_REVIEW_RESULT.APPROVED:
      return CAMPAIGN_STATUS.ACTIVE;
    case AI_REVIEW_RESULT.REJECTED:
      return CAMPAIGN_STATUS.REJECTED;
    case AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED:
      return CAMPAIGN_STATUS.MANUAL_REVIEW;
    default:
      // قيمة غير متوقعة من الـ AI (خطأ بالعقد بين الخدمتين) — أسلم افتراض: راجع يدوي
      console.error(`[aiReview.service] Unexpected AI result value: "${aiResult}", defaulting to MANUAL_REVIEW`);
      return CAMPAIGN_STATUS.MANUAL_REVIEW;
  }
}

// ============================================
// 4.1.1 — الدالة الرئيسية: استدعاء خدمة الـ AI ومراجعة الحملة
// ============================================
/**
 * @param {Object} campaign - مستند الحملة
 * @returns {Promise<{result: string, score: number, feedback: string}>}
 * @throws {Error} if the AI service is not configured or the request fails
 *   (المستدعي مسؤول يمسك هالخطأ ويستدعي handleAIServiceFailure عند اللزوم)
 */
async function reviewCampaign(campaign) {
  const payload = buildReviewPayload(campaign);
  let data;
  try {
    data = await transport.postJson('/review', payload, {
      fallbackTimeoutMs: 100000,
      timeoutEnvKey: 'AI_CAMPAIGN_REVIEW_TIMEOUT_MS',
    });
  } catch (error) {
    throw Object.assign(new Error('AI review service call failed'), {
      code: error.code || 'AI_SERVICE_UNAVAILABLE',
      status: error.status || error.upstreamStatus || null,
    });
  }

  const allowedResults = Object.values(AI_REVIEW_RESULT).filter((result) => result !== AI_REVIEW_RESULT.PENDING);
  if (!allowedResults.includes(data.result) || !Number.isFinite(data.score) || data.score < 0 || data.score > 100 || typeof data.feedback !== 'string' || !data.feedback.trim()) {
    throw Object.assign(new Error('AI service returned an invalid campaign review response'), {
      code: 'AI_SERVICE_BAD_RESPONSE',
    });
  }

  return { result: data.result, score: data.score, feedback: data.feedback };
}

// ============================================
// 4.1.4 — معالجة فشل خدمة الـ AI
// ============================================
/**
 * بتحول الحملة تلقائيًا لـ MANUAL_REVIEW وتسجل الخطأ، بدل ما تفشل العملية كاملة
 * على المستخدم. هاي الدالة بتعدل الحملة وتحفظها فعليًا (side effect متعمد).
 *
 * @param {Object} campaign - مستند الحملة (Mongoose document، لازم يكون قابل لـ .save())
 * @param {string} [failureReason] - سبب الفشل (اختياري، للتوثيق بالـ activity log)
 * @returns {Promise<Object>} الحملة بعد التحديث
 */
async function handleAIServiceFailure(campaign, failureReason = 'Unknown error') {
  campaign.status = CAMPAIGN_STATUS.MANUAL_REVIEW;
  campaign.aiReview.result = AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED;
  campaign.aiReview.feedback = 'AI review service unavailable — sent for manual review automatically.';
  campaign.aiReview.reviewedAt = new Date();

  await campaign.save();

  await logActivity(campaign._id, CAMPAIGN_ACTION.SENT_TO_MANUAL_REVIEW, null, {
    reason: 'AI_SERVICE_FAILURE',
    details: failureReason,
  });

  return campaign;
}

module.exports = {
  reviewCampaign,
  buildReviewPayload,
  mapAIResultToStatus,
  handleAIServiceFailure,
};
