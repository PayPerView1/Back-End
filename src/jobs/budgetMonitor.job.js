// src/jobs/budgetMonitor.job.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const Campaign = require('../models/campaign');
const CampaignActivityLog = require('../models/CampaignActivityLog');
const { sendBudgetExhaustedEmail } = require('../services/emailService');
const { CAMPAIGN_STATUS, PAUSE_REASON, CAMPAIGN_ACTION } = require('../constants/campaign.constants');

// ----------------------
// منطق المراقبة — مستقل عن الـ cron لتسهيل الاختبار
// ----------------------
const runBudgetMonitor = async () => {
  console.log('[budgetMonitor] Running budget check...');

  // جلب كل الحملات النشطة التي نفد رصيدها
  const exhaustedCampaigns = await Campaign.find({
    status: CAMPAIGN_STATUS.ACTIVE,
    remainingBudget: { $lte: 0 },
  }).populate('advertiserId', 'fullName email');

  if (exhaustedCampaigns.length === 0) {
    console.log('[budgetMonitor] No exhausted campaigns found.');
    return;
  }

  console.log(`[budgetMonitor] Found ${exhaustedCampaigns.length} exhausted campaign(s).`);

  // معالجة كل حملة بشكل مستقل — فشل واحدة لا يوقف الباقية
  for (const campaign of exhaustedCampaigns) {
    try {
      // تحديث حالة الحملة
      await Campaign.findByIdAndUpdate(campaign._id, {
        status: CAMPAIGN_STATUS.PAUSED,
        pauseReason: PAUSE_REASON.BUDGET_EXHAUSTED,
      });

      // تسجيل في ActivityLog
      await CampaignActivityLog.create({
        campaignId: campaign._id,
        action: CAMPAIGN_ACTION.BUDGET_EXHAUSTED,
        performedBy: null, // null = النظام
        metadata: {
          remainingBudget: campaign.remainingBudget,
          pausedAt: new Date(),
        },
      });

      // إرسال إيميل للمعلن
      if (campaign.advertiserId?.email) {
        await sendBudgetExhaustedEmail(campaign.advertiserId, {
          campaignName: campaign.name,
          campaignId: campaign._id,
        });
      }

      console.log(`[budgetMonitor] Paused campaign: ${campaign.name} (${campaign._id})`);
    } catch (error) {
      // تسجيل الخطأ والمتابعة مع الحملات الأخرى
      console.error(
        `[budgetMonitor] Failed to process campaign ${campaign._id}: ${error.message}`
      );
    }
  }

  console.log('[budgetMonitor] Budget check completed.');
};

// ----------------------
// تسجيل الـ Cron Job
// ----------------------
const startBudgetMonitor = () => {
  // كل 5 دقائق
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runBudgetMonitor();
    } catch (error) {
      console.error('[budgetMonitor] Unexpected error:', error.message);
    }
  });

  console.log('[budgetMonitor] Budget monitor job scheduled (every 5 minutes).');
};

module.exports = { startBudgetMonitor, runBudgetMonitor };