// src/constants/submission.constants.js
// ثوابت سبرنت 5: تسليم المحتوى + تنزيل المواد
const { AI_REVIEW_RESULT } = require('./campaign.constants');

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// المنصات المدعومة (R2.09)
const PLATFORM = {
  TIKTOK: 'TIKTOK',
  INSTAGRAM: 'INSTAGRAM',
  YOUTUBE: 'YOUTUBE',
};

// حالة التسليم "الفعلية" المخزّنة
const SUBMISSION_STATUS = {
  SUBMITTED: 'SUBMITTED',       // استُلم، والفحص الآلي قيد التنفيذ
  UNDER_REVIEW: 'UNDER_REVIEW', // بانتظار إنسان: مدقق يدوي (أدمن) أو المعلن
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

// الحالات التي "تحجز" الرابط وتُحتسب ضمن حد التسليمات لكل مبدع/حملة.
// الرفض والسحب يحرران الرابط ليُعاد تسليمه بعد التعديل.
const LINK_HOLDING_STATUSES = [
  SUBMISSION_STATUS.SUBMITTED,
  SUBMISSION_STATUS.UNDER_REVIEW,
  SUBMISSION_STATUS.APPROVED,
];

// قرار المعلن (advertiser_status في المتطلبات + AUTO_APPROVED للاعتماد التلقائي بعد المهلة)
const ADVERTISER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  AUTO_APPROVED: 'AUTO_APPROVED',
};

// قرار المدقق اليدوي (أدمن) عند تحويل الـ AI للمراجعة اليدوية
const ADMIN_DECISION = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
};

// من رفض التسليم
const REJECTED_BY = {
  AI: 'AI',
  RULES: 'RULES', // فحوصات الباك إند (هاشتاقات...) إن وصل التسليم بدونها
  ADVERTISER: 'ADVERTISER',
  ADMIN: 'ADMIN',
};

// نتائج الفحوصات الجزئية (تظهر كبطاقات في الواجهة)
const CHECK_STATUS = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  SKIPPED: 'SKIPPED',
};

const CHECK_SOURCE = {
  RULES: 'RULES', // يحسبها الباك إند (هاشتاقات، منشن، مدة...)
  AI: 'AI',       // تأتي من خدمة الـ AI
};

// أكواد معروفة للفرونت (للترجمة). الحقل code في الـ model نص حر
// حتى لا نفقد نتيجة من مهندس الـ AI لو أضاف كوداً جديداً.
const CHECK_CODE = {
  LINK_REACHABLE: 'LINK_REACHABLE',
  VIDEO_FORMAT: 'VIDEO_FORMAT',
  DURATION: 'DURATION',
  AUDIO_COMPLIANCE: 'AUDIO_COMPLIANCE', // خلو من المعازف
  REQUIRED_HASHTAGS: 'REQUIRED_HASHTAGS',
  REQUIRED_KEYWORDS: 'REQUIRED_KEYWORDS',
  OFFICIAL_MENTION: 'OFFICIAL_MENTION',
  LOGO_VISIBLE: 'LOGO_VISIBLE',
  AUDIO_CLARITY: 'AUDIO_CLARITY',
  PRESENTATION_QUALITY: 'PRESENTATION_QUALITY',
  BRIEF_ALIGNMENT: 'BRIEF_ALIGNMENT',
  COMMERCIAL_ELEMENTS: 'COMMERCIAL_ELEMENTS',
};

// نتيجة محاولة جلب بيانات المنشور من المنصة
const POST_FETCH_STATUS = {
  OK: 'OK',
  UNAVAILABLE: 'UNAVAILABLE', // المنصة لا تتيح البيانات (مثلاً إنستغرام بدون توكن) أو انتهت المهلة
  NOT_FOUND: 'NOT_FOUND',
  PRIVATE: 'PRIVATE',
};

// الحالة المعروضة للمستخدم (محسوبة، لا تُخزَّن)
const DISPLAY_STATUS = {
  PROCESSING: 'PROCESSING',
  AI_REJECTED: 'AI_REJECTED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  AWAITING_ADVERTISER: 'AWAITING_ADVERTISER',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

// تبويبات صفحة "اختر الحملة لتسليمها"
const ELIGIBLE_TAB = {
  ALL: 'ALL',
  READY: 'READY',
  ENDING_SOON: 'ENDING_SOON',
};

// التنزيل
const DOWNLOAD_TYPE = {
  FILE: 'FILE',
  ARCHIVE: 'ARCHIVE',
  BRIEF_PDF: 'BRIEF_PDF',
};

const DOWNLOAD_STATUS = {
  REQUESTED: 'REQUESTED', // أُصدر رابط التنزيل
  STARTED: 'STARTED',     // استُهلك الرابط (بدأ التنزيل فعلياً)
  COMPLETED: 'COMPLETED', // الفرونت أبلغ بالنجاح
  FAILED: 'FAILED',       // الفرونت أبلغ بالفشل
};

// إعدادات قابلة للتغيير من .env
const SUBMISSION_CONFIG = {
  MAX_ACTIVE_PER_CREATOR_PER_CAMPAIGN: toInt(process.env.SUBMISSION_MAX_ACTIVE_PER_CAMPAIGN, 5),
  REVIEW_DEADLINE_HOURS: toInt(process.env.SUBMISSION_REVIEW_DEADLINE_HOURS, 24),
  ENDING_SOON_HOURS: toInt(process.env.SUBMISSION_ENDING_SOON_HOURS, 48),
  AI_MAX_ATTEMPTS: 3,
  PROCESSING_LOCK_MINUTES: 5,
  MANUAL_REVIEW_ETA_HOURS: { MIN: 4, MAX: 8 },
  DRAFT_EXPIRY_DAYS: 30,
  NOTES_MAX_LENGTH: 500,
  URL_MAX_LENGTH: 500,
  MAX_HASHTAGS: 30,
  DOWNLOAD_LINK_TTL_SECONDS: toInt(process.env.DOWNLOAD_LINK_TTL_SECONDS, 300),
};

/**
 * الحالة المعروضة في الواجهة، محسوبة من الحقول المخزّنة.
 * تعمل مع مستند mongoose أو كائن lean.
 */
const getDisplayStatus = (submission) => {
  const { status, rejectedBy, aiReview, adminReview } = submission;

  switch (status) {
    case SUBMISSION_STATUS.WITHDRAWN:
      return DISPLAY_STATUS.WITHDRAWN;
    case SUBMISSION_STATUS.APPROVED:
      return DISPLAY_STATUS.APPROVED;
    case SUBMISSION_STATUS.REJECTED:
      return rejectedBy === REJECTED_BY.AI || rejectedBy === REJECTED_BY.RULES
        ? DISPLAY_STATUS.AI_REJECTED
        : DISPLAY_STATUS.REJECTED;
    case SUBMISSION_STATUS.SUBMITTED:
      return DISPLAY_STATUS.PROCESSING;
    case SUBMISSION_STATUS.UNDER_REVIEW: {
      const waitingAdmin =
        aiReview?.status === AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED && !adminReview?.decision;
      return waitingAdmin ? DISPLAY_STATUS.MANUAL_REVIEW : DISPLAY_STATUS.AWAITING_ADVERTISER;
    }
    default:
      return status;
  }
};

/**
 * رقم مرجعي للعرض (SUB-2026-A3F9C2). للعرض فقط وليس للبحث أو الربط.
 */
const buildSubmissionCode = (submission) => {
  const year = new Date(submission.submittedAt || submission.createdAt || Date.now()).getUTCFullYear();
  return `SUB-${year}-${String(submission._id).slice(-6).toUpperCase()}`;
};

module.exports = {
  PLATFORM,
  SUBMISSION_STATUS,
  LINK_HOLDING_STATUSES,
  ADVERTISER_STATUS,
  ADMIN_DECISION,
  REJECTED_BY,
  CHECK_STATUS,
  CHECK_SOURCE,
  CHECK_CODE,
  POST_FETCH_STATUS,
  DISPLAY_STATUS,
  ELIGIBLE_TAB,
  DOWNLOAD_TYPE,
  DOWNLOAD_STATUS,
  SUBMISSION_CONFIG,
  getDisplayStatus,
  buildSubmissionCode,
};