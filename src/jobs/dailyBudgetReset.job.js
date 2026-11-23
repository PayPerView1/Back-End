// src/jobs/dailyBudgetReset.job.js

const cron = require('node-cron');
const Campaign = require('../models/campaign');
const CampaignActivityLog = require('../models/CampaignActivityLog');
const CampaignBudgetSnapshot = require('../models/CampaignBudgetSnapshot');
const { CAMPAIGN_STATUS, PAUSE_REASON, CAMPAIGN_ACTION } = require('../constants/campaign.constants');

// ----------------------
// منطق الـ Reset — مستقل عن الـ cron لتسهيل الاختبار
// ----------------------
const runDailyBudgetReset = async () => {
  console.log('[dailyBudgetReset] Running daily budget reset...');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // Persist only a complete, real UTC-day observation before resetting the counter.
  // If the job missed a day, do not spread an accumulated value over invented dates.
  const completedDayCampaigns = await Campaign.find({
    dailyBudgetResetAt: yesterday,
    createdAt: { $lt: today },
  }).select('_id dailyBudgetSpent remainingBudget dailyBudgetLimit totalBudget category contentType').lean();
  if (completedDayCampaigns.length) {
    await CampaignBudgetSnapshot.bulkWrite(completedDayCampaigns.map((campaign) => ({
      updateOne: {
        filter: { campaignId: campaign._id, day: yesterday },
        update: { $setOnInsert: {
          campaignId: campaign._id,
          day: yesterday,
          dailySpend: Math.max(0, Number(campaign.dailyBudgetSpent) || 0),
          remainingBudget: Math.max(0, Number(campaign.remainingBudget) || 0),
          dailyBudgetLimit: campaign.dailyBudgetLimit ?? null,
          totalBudget: Math.max(0, Number(campaign.totalBudget) || 0),
          category: campaign.category || null,
          contentType: campaign.contentType || null,
        } },
        upsert: true,
      },
    })), { ordered: false });
  }

  // Reset the daily counter for every campaign; spend tracking is used by analytics too.
  const resetResult = await Campaign.updateMany(
    {
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
