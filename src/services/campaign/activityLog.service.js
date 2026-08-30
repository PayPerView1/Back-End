// src/services/campaign/activityLog.service.js
const CampaignActivityLog = require('../../models/CampaignActivityLog');
const { CAMPAIGN_ACTION } = require('../../constants/campaign.constants');

/**
 * بتسجل حدث (action) صار على حملة معينة بسجل الأحداث (Activity Log)
 *
 * ⚠️ مهم: هاي الدالة ما بترمي exception أبدًا حتى لو فشلت — بس بتسجل الخطأ بالـ console.
 * السبب: تسجيل النشاط عملية "ثانوية" (side effect)، ما لازم فشلها يوقف العملية
 * الأساسية (مثلاً إنشاء الحملة أو تحديثها). لو فشل التسجيل، أهم شي العملية
 * الأساسية تخلص، ونخسر بس سطر log واحد بدل ما نخسر العملية كاملة.
 *
 * @param {string|ObjectId} campaignId - معرّف الحملة يلي صار عليها الحدث
 * @param {string} action - نوع الحدث (لازم يكون من CAMPAIGN_ACTION)
 * @param {string|ObjectId|null} performedBy - معرّف المستخدم يلي عمل الحدث
 *   (null = النظام نفسه عمله، زي الـ AI أو الـ cron job)
 * @param {Object|null} metadata - أي بيانات إضافية مرنة متعلقة بالحدث
 *   (مثلاً: سبب الرفض، القيمة القديمة/الجديدة لحقل معين...)
 * @returns {Promise<Object|null>} السجل المحفوظ، أو null لو فشل التسجيل
 */
async function logActivity(campaignId, action, performedBy = null, metadata = null) {
  try {
    // 1. التحقق من صحة الـ action قبل أي محاولة حفظ
    const validActions = Object.values(CAMPAIGN_ACTION);

    if (!validActions.includes(action)) {
      // ما منرمي exception حتى هون — بس منسجل تحذير ومنوقف بهدوء
      console.error(`[ActivityLog] Invalid action attempted: "${action}" for campaign ${campaignId}`);
      return null;
    }

    // 2. التحقق من وجود campaignId (أساسي، بدونه الـ log مالوش معنى)
    if (!campaignId) {
      console.error('[ActivityLog] Missing campaignId, activity not logged');
      return null;
    }

    // 3. إنشاء وحفظ السجل
    const logEntry = await CampaignActivityLog.create({
      campaignId,
      action,
      performedBy,
      metadata,
    });

    return logEntry;
  } catch (error) {
    // أي خطأ غير متوقع (مشكلة اتصال بقاعدة البيانات، إلخ) —
    // منسجله بس ما منكسر تنفيذ العملية الأساسية يلي استدعت هالدالة
    console.error(`[ActivityLog] Failed to log activity: ${error.message}`);
    return null;
  }
}

module.exports = {
  logActivity,
};