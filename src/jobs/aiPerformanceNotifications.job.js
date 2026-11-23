const cron = require('node-cron');
const Campaign = require('../models/campaign');
const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
const { NOTIFICATION_TYPE } = require('../constants/discovery.constants');
const { notifyUserOnce } = require('../services/notification/notification.service');

let isRunning = false;

const utcMidnight = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const runAiPerformanceNotifications = async (now = new Date()) => {
  if (isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
  isRunning = true;
  try {
    const end = utcMidnight(now); // Only compare complete UTC days.
    const start = new Date(end.getTime() - 14 * 86400000);
    const campaigns = await Campaign.find({ status: 'ACTIVE', advertiserId: { $ne: null } })
      .select('_id advertiserId name').lean();
    if (!campaigns.length) return { scanned: 0, notified: 0 };

    const campaignById = new Map(campaigns.map((item) => [String(item._id), item]));
    const daily = await SubmissionViewSnapshot.aggregate([
      { $match: {
        campaignId: { $in: campaigns.map((item) => item._id) },
        capturedAt: { $gte: start, $lt: end },
        fetchStatus: 'OK',
        reviewStatus: { $in: ['CLEAR', 'CONFIRMED'] },
      } },
      { $project: {
        campaignId: 1,
        day: { $dateToString: { format: '%Y-%m-%d', date: '$capturedAt', timezone: 'UTC' } },
        views: { $ifNull: ['$eligibleViews', 0] },
      } },
      { $group: { _id: { campaignId: '$campaignId', day: '$day' }, views: { $sum: '$views' } } },
    ]);
    const values = new Map();
    for (const item of daily) {
      const id = String(item._id.campaignId);
      const byDay = values.get(id) || new Map();
      byDay.set(item._id.day, Number(item.views) || 0);
      values.set(id, byDay);
    }

    let notified = 0;
    for (const [campaignId, byDay] of values) {
      const campaign = campaignById.get(campaignId);
      if (!campaign?.advertiserId) continue;
      const previousDays = [];
      const recentDays = [];
      for (let offset = 14; offset > 7; offset -= 1) {
        const day = new Date(end.getTime() - offset * 86400000).toISOString().slice(0, 10);
        if (byDay.has(day)) previousDays.push(byDay.get(day));
      }
      for (let offset = 7; offset > 0; offset -= 1) {
        const day = new Date(end.getTime() - offset * 86400000).toISOString().slice(0, 10);
        if (byDay.has(day)) recentDays.push(byDay.get(day));
      }
      if (previousDays.length < 5 || recentDays.length < 5) continue;
      const previousAverage = previousDays.reduce((sum, value) => sum + value, 0) / previousDays.length;
      const recentAverage = recentDays.reduce((sum, value) => sum + value, 0) / recentDays.length;
      if (previousAverage < 20 || recentAverage > previousAverage * 0.5) continue;

      const dropPercent = Math.round((1 - recentAverage / previousAverage) * 100);
      const endKey = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
      const created = await notifyUserOnce(campaign.advertiserId, {
        type: NOTIFICATION_TYPE.AI_PERFORMANCE_ALERT,
        title: 'Campaign views have dropped',
        message: `Validated views for "${String(campaign.name || 'your campaign').slice(0, 100)}" fell by about ${dropPercent}% compared with the previous seven-day period. This is a performance alert, not a fraud finding.`,
        data: { campaignId, kind: 'VALIDATED_VIEW_DROP', dropPercent, periodEnd: endKey },
      }, `AI_VIEW_DROP:${campaignId}:${endKey}`);
      if (created) notified += 1;
    }
    return { scanned: campaigns.length, notified };
  } catch (error) {
    console.error('[aiPerformanceNotifications] run failed:', error.message);
    return { error: true };
  } finally {
    isRunning = false;
  }
};

const startAiPerformanceNotifications = () => {
  cron.schedule('15 6 * * *', () => runAiPerformanceNotifications(), { timezone: 'UTC' });
  console.log('[aiPerformanceNotifications] scheduled daily at 06:15 UTC');
};

module.exports = { runAiPerformanceNotifications, startAiPerformanceNotifications };
