// src/services/campaign/aiReview.service.js
const {
  AI_REVIEW_RESULT,
  CAMPAIGN_STATUS,
  CAMPAIGN_ACTION,
} = require('../../constants/campaign.constants');
const { logActivity } = require('./activityLog.service');

// مهلة انتظار الطلب لخدمة الـ AI (بالميلي ثانية) قبل ما نعتبره فشل
const AI_SERVICE_TIMEOUT_MS = 10000; // 10 ثواني

// ============================================
// 4.1.2 — تجهيز البيانات المرسلة لخدمة الـ AI
// ============================================
/**
 * @param {Object} campaign - مستند الحملة (Mongoose document أو object عادي)
 * @returns {Object} البيانات يلي رح تنرسل لخدمة الـ AI الخارجية
 */
function buildReviewPayload(campaign) {
  return {
    campaignName: campaign.name,
    brief: campaign.brief,
    targetCountries: campaign.targetCountries,
    halalDeclaration: campaign.halalDeclaration,
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

/**
 * بترجع نتيجة Mock (تجريبية) بدون أي استدعاء شبكة فعلي —
 * بتستخدم تلقائيًا لو AI_SERVICE_URL مش موجودة بـ .env (يعني الخدمة الحقيقية لسا مش جاهزة)
 */
function getMockReviewResult() {
  return {
    result: AI_REVIEW_RESULT.APPROVED,
    score: 95,
    feedback: 'Mock approval — AI microservice not configured yet (AI_SERVICE_URL missing).',
  };
}

// ============================================
// 4.1.1 — الدالة الرئيسية: استدعاء خدمة الـ AI ومراجعة الحملة
// ============================================
/**
 * @param {Object} campaign - مستند الحملة
 * @returns {Promise<{result: string, score: number, feedback: string}>}
 * @throws {Error} لو خدمة الـ AI مُعدّة (AI_SERVICE_URL موجود) بس الاستدعاء فشل فعليًا
 *   (المستدعي مسؤول يمسك هالخطأ ويستدعي handleAIServiceFailure عند اللزوم)
 */
async function reviewCampaign(campaign) {
  const aiServiceUrl = process.env.AI_SERVICE_URL;

  // ما فيه رابط خدمة أصلاً → وضع Mock تلقائي (Task 4.1.5)
  if (!aiServiceUrl) {
    return getMockReviewResult();
  }

  const payload = buildReviewPayload(campaign);

  // AbortController لضبط مهلة انتظار، عشان ما نستنى إلى الأبد لو الخدمة واطية
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${aiServiceUrl}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI service responded with status ${response.status}`);
    }

    const data = await response.json();

    return {
      result: data.result,
      score: data.score,
      feedback: data.feedback,
    };
  } catch (error) {
    // منرمي خطأ موحد وواضح، بغض النظر شو كان سبب الفشل بالتفصيل (timeout، شبكة، رد غلط...)
    throw new Error(`AI review service call failed: ${error.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
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
  getMockReviewResult,
};