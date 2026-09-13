// src/jobs/draftExpiry.job.js
const cron = require('node-cron');
const { expireDrafts } = require('../services/campaign/campaignDraft.service');

// جدولة التشغيل يوميًا عند منتصف الليل بالظبط (00:00)
// صيغة node-cron: (دقيقة، ساعة، يوم الشهر، شهر، يوم الأسبوع)
const CRON_SCHEDULE = '0 0 * * *';

/**
 * بتبدأ الـ cron job — بتستدعى مرة وحدة بس وقت تشغيل السيرفر (من server.js)
 */
function startDraftExpiryJob() {
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[draftExpiry.job] Running daily draft expiry check...');

    try {
      const expiredCount = await expireDrafts();
      console.log(`[draftExpiry.job] Done. ${expiredCount} draft(s) marked as EXPIRED.`);
    } catch (error) {
      // نفس فلسفة باقي الملفات — الـ job ما لازم يوقف السيرفر لو فشل، بس نسجل الخطأ
      console.error(`[draftExpiry.job] Failed to run: ${error.message}`);
    }
  });

  console.log(`[draftExpiry.job] Scheduled to run daily at midnight (cron: "${CRON_SCHEDULE}")`);
}

module.exports = startDraftExpiryJob;