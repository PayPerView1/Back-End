const mongoose = require('mongoose');
const Campaign = require('../../models/campaign');
const CreatorEarning = require('../../models/CreatorEarning');
const SubmissionViewSnapshot = require('../../models/SubmissionViewSnapshot');
const aiIntelligence = require('../ai/aiIntelligence.client');

const WINDOW_DAYS = 7;
const MATURITY_HOLD_DAYS = 7;
const MAX_CAMPAIGN_DAYS = 700;
const CONFIRMED_EARNING_STATES = ['AVAILABLE', 'PARTIALLY_RESERVED', 'RESERVED', 'PAID'];

const emptyPrediction = (explanation) => ({
  status: 'INSUFFICIENT_DATA',
  windowDays: WINDOW_DAYS,
  currency: 'USD',
  method: 'MATURED_VIEW_TREND_AND_REALIZED_CPM',
  estimatedGrossAmountCents: null,
  estimatedCreatorNetAmountCents: null,
  predictedNext7DaysViews: null,
  confidence: 0,
  campaignsAnalyzed: 0,
  campaignsEstimated: 0,
  explanation,
  campaigns: [],
});

const getCreatorEarningsPrediction = async (creatorId, now = new Date()) => {
  const utcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(utcDay - 14 * 24 * 60 * 60 * 1000);
  const maturedUntil = new Date(utcDay - MATURITY_HOLD_DAYS * 24 * 60 * 60 * 1000);
  const creatorObjectId = new mongoose.Types.ObjectId(String(creatorId));

  const [viewHistory, ledgerHistory] = await Promise.all([
    SubmissionViewSnapshot.aggregate([
      { $match: {
        creatorId: creatorObjectId,
        capturedAt: { $gte: from, $lt: maturedUntil },
        fetchStatus: 'OK',
        reviewStatus: { $in: ['CLEAR', 'CONFIRMED'] },
      } },
      { $group: {
        _id: { campaignId: '$campaignId', day: { $dateToString: { format: '%Y-%m-%d', date: '$capturedAt', timezone: 'UTC' } } },
        validatedViews: { $sum: '$eligibleViews' },
      } },
      { $sort: { '_id.day': 1, '_id.campaignId': 1 } },
      { $limit: MAX_CAMPAIGN_DAYS + 1 },
    ]),
    CreatorEarning.aggregate([
      { $match: {
        creatorId: creatorObjectId,
        createdAt: { $gte: from, $lt: maturedUntil },
        availableAt: { $lte: now },
        status: { $in: CONFIRMED_EARNING_STATES },
      } },
      { $group: {
        _id: { campaignId: '$campaignId', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } } },
        validatedViews: { $sum: '$views' },
        confirmedGrossAmountCents: { $sum: '$grossAmountCents' },
        confirmedCreatorNetAmountCents: { $sum: '$netAmountCents' },
      } },
      { $sort: { '_id.day': 1, '_id.campaignId': 1 } },
      { $limit: MAX_CAMPAIGN_DAYS + 1 },
    ]),
  ]);

  if (viewHistory.length > MAX_CAMPAIGN_DAYS || ledgerHistory.length > MAX_CAMPAIGN_DAYS) {
    return emptyPrediction('Historical view volume exceeds the analysis limit; no partial estimate was returned.');
  }

  const campaignIds = [...new Set([...viewHistory, ...ledgerHistory]
    .map((item) => String(item._id.campaignId || ''))
    .filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  if (!campaignIds.length) {
    return emptyPrediction('No matured, validated view and confirmed earning history is available for this creator.');
  }
  if (campaignIds.length > 100) {
    return emptyPrediction('More than 100 campaigns have matured history; no partial estimate was returned.');
  }

  const campaigns = await Campaign.find({ _id: { $in: campaignIds } }).select('_id cpm').lean();
  const cpmByCampaign = new Map(campaigns.map((campaign) => [String(campaign._id), Number(campaign.cpm)]));
  const historyByCampaign = new Map();
  for (const item of viewHistory) {
    const campaignId = String(item._id.campaignId);
    const history = historyByCampaign.get(campaignId) || new Map();
    history.set(item._id.day, {
      day: item._id.day,
      validatedViews: Math.max(0, Number(item.validatedViews) || 0),
      confirmedGrossAmountCents: 0,
      confirmedCreatorNetAmountCents: 0,
    });
    historyByCampaign.set(campaignId, history);
  }
  for (const item of ledgerHistory) {
    const campaignId = String(item._id.campaignId);
    const history = historyByCampaign.get(campaignId) || new Map();
    const daily = history.get(item._id.day) || {
      day: item._id.day, validatedViews: 0,
      confirmedGrossAmountCents: 0, confirmedCreatorNetAmountCents: 0,
    };
    if (!daily.validatedViews) daily.validatedViews = Math.max(0, Number(item.validatedViews) || 0);
    daily.confirmedGrossAmountCents = Math.max(0, Number(item.confirmedGrossAmountCents) || 0);
    daily.confirmedCreatorNetAmountCents = Math.max(0, Number(item.confirmedCreatorNetAmountCents) || 0);
    history.set(item._id.day, daily);
    historyByCampaign.set(campaignId, history);
  }

  const payload = {
    asOfDate: now.toISOString().slice(0, 10),
    campaigns: [...historyByCampaign.entries()].map(([campaignId, history]) => ({
      campaignId,
      applicableCpm: Number.isFinite(cpmByCampaign.get(campaignId)) && cpmByCampaign.get(campaignId) > 0
        ? cpmByCampaign.get(campaignId) : 0,
      dailyHistory: [...history.values()].sort((left, right) => left.day.localeCompare(right.day)),
    })),
  };
  return aiIntelligence.predictCreatorEarnings(payload);
};

module.exports = {
  getCreatorEarningsPrediction,
  emptyPrediction,
  WINDOW_DAYS,
  MATURITY_HOLD_DAYS,
  MAX_CAMPAIGN_DAYS,
};
