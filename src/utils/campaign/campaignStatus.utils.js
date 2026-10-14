// src/utils/campaign/campaignStatus.utils.js
const { CAMPAIGN_STATUS } = require('../../constants/campaign.constants');
 
// ============================================
// جدول الانتقالات المسموحة (مبني على Campaign Status Lifecycle diagram)
// ============================================
// كل مفتاح = الحالة الحالية، والقيمة = مصفوفة الحالات المسموح الانتقال لها منها
//
// DRAFT → PENDING_REVIEW              (submit)
// PENDING_REVIEW → ACTIVE / REJECTED / MANUAL_REVIEW   (نتيجة AI review)
// MANUAL_REVIEW → ACTIVE / REJECTED   (قرار الـ ADMIN)
// ACTIVE → COMPLETED / PAUSED / MANUALLY_PAUSED / CANCELLED / EXPIRED
// PAUSED / MANUALLY_PAUSED → ACTIVE / COMPLETED / CANCELLED / EXPIRED
//
// ⚠️ [Sprint 4] أُضيفت انتقالات PAUSED و MANUALLY_PAUSED و CANCELLED
// (كانت ناقصة: الجدول لم يكن يعرف هذه الحالات أصلاً).
// الإلغاء CANCELLED يحدث عند تأكيد مخالفة بعد بلاغ (report.service).
//
// ⚠️ ملاحظة: الأرشفة (ARCHIVED) والاستعادة مش موجودين هون كـ "status transition" —
// هي بتتحكم فيها حقول منفصلة (isArchived + archivedAt) على مستوى الـ Campaign model نفسه،
// مش عن طريق تغيير حقل status. لهيك ARCHIVED مش موجودة كوجهة بهالجدول.
//
// ⚠️ الإيقاف بسبب بلاغ (isSuspended) كذلك حقل منفصل وليس status،
// حتى لا نضطر لحفظ الحالة السابقة واستعادتها عند رفع الإيقاف.
//
// الحالات النهائية (REJECTED, COMPLETED, CANCELLED, EXPIRED) ما إلها أي انتقال تالي —
// المسار الوحيد المتاح لهم بعدها هو الأرشفة (تحقق منها isArchivable، مش هالجدول).
const ALLOWED_TRANSITIONS = {
  [CAMPAIGN_STATUS.DRAFT]: [CAMPAIGN_STATUS.PENDING_REVIEW],
  [CAMPAIGN_STATUS.PENDING_REVIEW]: [
    CAMPAIGN_STATUS.ACTIVE,
    CAMPAIGN_STATUS.REJECTED,
    CAMPAIGN_STATUS.MANUAL_REVIEW,
  ],
  [CAMPAIGN_STATUS.MANUAL_REVIEW]: [CAMPAIGN_STATUS.ACTIVE, CAMPAIGN_STATUS.REJECTED],
  [CAMPAIGN_STATUS.ACTIVE]: [
    CAMPAIGN_STATUS.COMPLETED,
    CAMPAIGN_STATUS.PAUSED,
    CAMPAIGN_STATUS.MANUALLY_PAUSED,
    CAMPAIGN_STATUS.CANCELLED,
    CAMPAIGN_STATUS.EXPIRED,
  ],
  [CAMPAIGN_STATUS.PAUSED]: [
    CAMPAIGN_STATUS.ACTIVE,
    CAMPAIGN_STATUS.COMPLETED,
    CAMPAIGN_STATUS.CANCELLED,
    CAMPAIGN_STATUS.EXPIRED,
  ],
  [CAMPAIGN_STATUS.MANUALLY_PAUSED]: [
    CAMPAIGN_STATUS.ACTIVE,
    CAMPAIGN_STATUS.COMPLETED,
    CAMPAIGN_STATUS.CANCELLED,
    CAMPAIGN_STATUS.EXPIRED,
  ],
  [CAMPAIGN_STATUS.REJECTED]: [],
  [CAMPAIGN_STATUS.COMPLETED]: [],
  [CAMPAIGN_STATUS.CANCELLED]: [],
  [CAMPAIGN_STATUS.ARCHIVED]: [],
  [CAMPAIGN_STATUS.EXPIRED]: [],
};
 
// ============================================
// الحالات يلي فيها تحذف الحملة (حذف فعلي/نهائي)
// ============================================
// بس DRAFT — لأنو أي حملة دخلت مرحلة المراجعة (PENDING_REVIEW فما فوق) بيصير إلها
// تاريخ فعلي (activity log, submissions...)، فما بينحذفوا نهائيًا، بس بينحطوا بالأرشيف.
const DELETABLE_STATUSES = [CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.REJECTED];
 
// ============================================
// الحالات يلي فيها تتأرشف الحملة
// ============================================
// بس الحالات "النهائية" (Terminal) — يعني خلصت مسارها الطبيعي.
// حملة ACTIVE ما بتنأرشف مباشرة (لازم توصل COMPLETED أو REJECTED أول).
const ARCHIVABLE_STATUSES = [
  CAMPAIGN_STATUS.REJECTED,
  CAMPAIGN_STATUS.COMPLETED,
  CAMPAIGN_STATUS.CANCELLED,
  CAMPAIGN_STATUS.EXPIRED,
];
 
// ============================================
// [Sprint 4] الحالات يلي فيها تنلغى الحملة بقرار إشراف (تأكيد مخالفة)
// ============================================
const CANCELLABLE_STATUSES = [
  CAMPAIGN_STATUS.ACTIVE,
  CAMPAIGN_STATUS.PAUSED,
  CAMPAIGN_STATUS.MANUALLY_PAUSED,
];
 
/**
 * بتتحقق هل الانتقال من حالة لحالة تانية مسموح حسب دورة حياة الحملة
 * @param {string} currentStatus - الحالة الحالية للحملة
 * @param {string} newStatus - الحالة المطلوب الانتقال لها
 * @returns {boolean}
 */
function isTransitionAllowed(currentStatus, newStatus) {
  const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus];
 
  // لو الحالة الحالية مش معرّفة أصلاً بالجدول، ما نسمح بأي انتقال (أمان افتراضي)
  if (!allowedNextStatuses) {
    return false;
  }
 
  return allowedNextStatuses.includes(newStatus);
}
 
/**
 * بتتحقق هل الحملة بحالتها الحالية فيها تنحذف نهائيًا
 * @param {string} status - الحالة الحالية للحملة
 * @returns {boolean}
 */
function isDeletable(status) {
  return DELETABLE_STATUSES.includes(status);
}
 
/**
 * بتتحقق هل الحملة بحالتها الحالية فيها تتأرشف
 * @param {string} status - الحالة الحالية للحملة
 * @returns {boolean}
 */
function isArchivable(status) {
  return ARCHIVABLE_STATUSES.includes(status);
}
 
/**
 * [Sprint 4] هل يمكن إلغاء الحملة بقرار إشراف؟
 * @param {string} status
 * @returns {boolean}
 */
function isCancellable(status) {
  return CANCELLABLE_STATUSES.includes(status);
}
 
/**
 * [Sprint 4] هل الحملة موقوفة بسبب بلاغ (قيد المراجعة)؟
 * تُستعمل كحارس في pause/resume/recharge وغيرها.
 * @param {object} campaign - مستند الحملة (أو lean object)
 * @returns {boolean}
 */
function isCampaignSuspended(campaign) {
  return !!campaign && campaign.isSuspended === true;
}
 
module.exports = {
  ALLOWED_TRANSITIONS,
  DELETABLE_STATUSES,
  ARCHIVABLE_STATUSES,
  CANCELLABLE_STATUSES,
  isTransitionAllowed,
  isDeletable,
  isArchivable,
  isCancellable,
  isCampaignSuspended,
};