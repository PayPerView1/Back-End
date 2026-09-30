// src/jobs/dailyBudgetReset.job.js

const cron = require('node-cron');
const Campaign = require('../models/campaign');
const CampaignActivityLog = require('../models/CampaignActivityLog');
const { CAMPAIGN_STATUS, PAUSE_REASON, CAMPAIGN_ACTION } = require('../constants/campaign.constants');

// ----------------------
// منطق الـ Reset — مستقل عن الـ cron لتسهيل الاختبار
// ----------------------
const runDailyBudgetReset = async () => {
  console.log('[dailyBudgetReset] Running daily budget reset...');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // ----------------------
  // الخطوة 1: Reset dailyBudgetSpent لكل الحملات
  // ----------------------
  const resetResult = await Campaign.updateMany(
    {
      dailyBudgetLimit: { $ne: null },
      $or: [
        { dailyBudgetResetAt: { $lt: today } },
        { dailyBudgetResetAt: null },
      ],
    },
    {
      $set: {
        dailyBudgetSpent: 0,
        dailyBudgetResetAt: today,
      },
    }
  );

  console.log(`[dailyBudgetReset] Reset daily spend for ${resetResult.modifiedCount} campaign(s).`);

  // ----------------------
  // الخطوة 2: استئناف الحملات الموقوفة بسبب الحد اليومي
  // ----------------------
  const campaignsToResume = await Campaign.find({
    status: CAMPAIGN_STATUS.PAUSED,
    pauseReason: PAUSE_REASON.DAILY_LIMIT_REACHED,
    remainingBudget: { $gt: 0 },
  });

  if (campaignsToResume.length === 0) {
    console.log('[dailyBudgetReset] No campaigns to resume.');
    return;
  }

  console.log(`[dailyBudgetReset] Resuming ${campaignsToResume.length} campaign(s).`);

  for (const campaign of campaignsToResume) {
    try {
      await Campaign.findByIdAndUpdate(campaign._id, {
        status: CAMPAIGN_STATUS.ACTIVE,
        pauseReason: null,
      });

      await CampaignActivityLog.create({
        campaignId: campaign._id,
        action: CAMPAIGN_ACTION.DAILY_LIMIT_RESET,
        performedBy: null, // null = النظام
        metadata: {
          resumedAt: new Date(),
          dailyBudgetLimit: campaign.dailyBudgetLimit,
        },
      });

      console.log(`[dailyBudgetReset] Resumed campaign: ${campaign.name} (${campaign._id})`);
    } catch (error) {
      console.error(
        `[dailyBudgetReset] Failed to resume campaign ${campaign._id}: ${error.message}`
      );
    }
  }

  console.log('[dailyBudgetReset] Daily budget reset completed.');
};

// ----------------------
// تسجيل الـ Cron Job
// ----------------------
const startDailyBudgetReset = () => {
  // كل يوم منتصف الليل UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      await runDailyBudgetReset();
    } catch (error) {
      console.error('[dailyBudgetReset] Unexpected error:', error.message);
    }
  });

  console.log('[dailyBudgetReset] Daily budget reset job scheduled (00:00 UTC).');
};

module.exports = { startDailyBudgetReset, runDailyBudgetReset };