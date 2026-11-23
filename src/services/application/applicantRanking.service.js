const mongoose = require('mongoose');
const Campaign = require('../../models/campaign');
const Application = require('../../models/application');
const CreatorPreferences = require('../../models/creatorPreferences');
const CreatorEarning = require('../../models/CreatorEarning');
const SubmissionViewSnapshot = require('../../models/SubmissionViewSnapshot');
const { AppError } = require('../../utils/errors');
const aiIntelligence = require('../ai/aiIntelligence.client');

const CONFIRMED_EARNING_STATES = ['AVAILABLE', 'PARTIALLY_RESERVED', 'RESERVED', 'PAID'];
const MAX_APPLICANTS = 200;
const HISTORY_DAYS = 90;
const VIEW_HOLD_DAYS = 7;

const dateFor = (value) => value instanceof Date ? value.toISOString() : value || null;

const getCampaignApplicantRanking = async (campaignId, brandId, now = new Date()) => {
  const campaign = await Campaign.findOne({ _id: campaignId, advertiserId: brandId })
    .select('_id name contentType category subCategories targetCountries brief')
    .lean();
  if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');

  const [applications, total] = await Promise.all([
    Application.find({ campaignId: campaign._id, status: 'PENDING' })
      .populate('creatorId', 'fullName profilePicture interests')
      .sort({ appliedAt: -1, _id: 1 }).limit(MAX_APPLICANTS).lean(),
    Application.countDocuments({ campaignId: campaign._id, status: 'PENDING' }),
  ]);
  const validApplications = applications.filter((item) => item.creatorId?._id);
  const creatorIds = [...new Set(validApplications.map((item) => String(item.creatorId._id)))];
  if (!validApplications.length) {
    return {
      campaignId: String(campaign._id), status: 'INSUFFICIENT_DATA', method: 'NONE', data: [],
      meta: { sampleSize: 0, rankedCount: 0, truncated: total > MAX_APPLICANTS, audienceCountryCoverage: 0, validatedPerformanceCoverage: 0, audienceDemographicsAvailable: ['COUNTRY'], unavailableDemographics: ['AGE', 'GENDER'] },
    };
  }

  const historyFrom = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const maturedBefore = new Date(now.getTime() - VIEW_HOLD_DAYS * 24 * 60 * 60 * 1000);
  const [preferences, earnings, audienceRows] = await Promise.all([
    CreatorPreferences.find({ creatorId: { $in: creatorIds } })
      .select('creatorId preferredContentTypes preferredCountries').lean(),
    CreatorEarning.find({
      creatorId: { $in: creatorIds },
      status: { $in: CONFIRMED_EARNING_STATES },
      availableAt: { $lte: now },
      createdAt: { $gte: historyFrom, $lte: now },
    }).sort({ createdAt: -1 }).limit(10000)
      .select('creatorId campaignId views').populate('campaignId', 'contentType category').lean(),
    SubmissionViewSnapshot.aggregate([
      { $match: {
        creatorId: { $in: creatorIds.map((id) => new mongoose.Types.ObjectId(id)) },
        fetchStatus: 'OK', reviewStatus: { $in: ['CLEAR', 'CONFIRMED'] },
        capturedAt: { $gte: historyFrom, $lte: maturedBefore }, eligibleViews: { $gt: 0 },
      } },
      { $unwind: '$countryDeltaViews' },
      { $group: { _id: { creatorId: '$creatorId', country: '$countryDeltaViews.countryCode' }, views: { $sum: '$countryDeltaViews.views' } } },
      { $sort: { views: -1 } },
    ]),
  ]);

  const preferencesByCreator = new Map(preferences.map((item) => [String(item.creatorId), item]));
  const performanceByCreator = new Map();
  for (const earning of earnings) {
    const creatorKey = String(earning.creatorId);
    const summary = performanceByCreator.get(creatorKey) || { validatedViews: 0, sampleSize: 0, categories: new Set() };
    summary.validatedViews += Number(earning.views) || 0;
    summary.sampleSize += 1;
    const campaignHistory = earning.campaignId;
    if (campaignHistory?.contentType) summary.categories.add(String(campaignHistory.contentType));
    if (campaignHistory?.category) summary.categories.add(String(campaignHistory.category));
    performanceByCreator.set(creatorKey, summary);
  }
  const measuredCountriesByCreator = new Map();
  for (const row of audienceRows) {
    const key = String(row._id.creatorId);
    if (!row._id.country) continue;
    const countries = measuredCountriesByCreator.get(key) || [];
    if (countries.length < 10) countries.push(String(row._id.country).toUpperCase());
    measuredCountriesByCreator.set(key, countries);
  }

  const campaignCategories = [...new Set([
    campaign.contentType, campaign.category, ...(campaign.subCategories || []),
  ].filter((item) => typeof item === 'string' && item.trim()).map((item) => item.toUpperCase()))];
  const aiApplicants = validApplications.map((application) => {
    const creatorId = String(application.creatorId._id);
    const prefs = preferencesByCreator.get(creatorId) || {};
    const performance = performanceByCreator.get(creatorId) || { validatedViews: 0, sampleSize: 0, categories: new Set() };
    const measured = measuredCountriesByCreator.get(creatorId) || [];
    const audienceCountries = measured.length ? measured : (prefs.preferredCountries || []).map((item) => String(item).toUpperCase());
    const categories = [...new Set([
      ...(prefs.preferredContentTypes || []), ...(application.creatorId.interests || []), ...performance.categories,
    ].map((item) => String(item).toUpperCase()))];
    return {
      id: String(application._id),
      content: categories.join(' ').slice(0, 3000),
      categories,
      audienceCountries,
      historicalPerformance: { sampleSize: performance.sampleSize, validatedViews: performance.validatedViews },
    };
  });

  const brief = campaign.brief || {};
  const campaignContent = [
    campaign.name, campaign.contentType, campaign.category, ...(campaign.subCategories || []),
    brief.mainIdea, brief.tone, brief.keyMessages, ...(brief.keywords || []), brief.visualReferences,
  ].filter((part) => typeof part === 'string' && part.trim()).join('\n').slice(0, 8000);
  const ranking = await aiIntelligence.rankApplicants({
    campaign: { id: String(campaign._id), content: campaignContent, categories: campaignCategories, targetCountries: (campaign.targetCountries || []).map((item) => String(item).toUpperCase()) },
    applicants: aiApplicants,
  });
  const rankingByApplication = new Map(ranking.data.map((item) => [item.applicantId, item]));
  const data = validApplications.map((application) => ({
    applicationId: String(application._id),
    status: application.status,
    message: application.message || '',
    appliedAt: dateFor(application.appliedAt),
    creator: { id: String(application.creatorId._id), fullName: application.creatorId.fullName, profilePicture: application.creatorId.profilePicture || null },
    aiMatch: rankingByApplication.get(String(application._id)) || null,
  })).sort((left, right) => (left.aiMatch?.rank || Number.MAX_SAFE_INTEGER) - (right.aiMatch?.rank || Number.MAX_SAFE_INTEGER));

  return {
    campaignId: String(campaign._id),
    status: ranking.status,
    method: ranking.method,
    data,
    meta: {
      sampleSize: validApplications.length,
      rankedCount: data.filter((item) => item.aiMatch).length,
      truncated: total > MAX_APPLICANTS,
      audienceCountryCoverage: aiApplicants.filter((item) => item.audienceCountries.length).length,
      validatedPerformanceCoverage: aiApplicants.filter((item) => item.historicalPerformance.sampleSize > 0).length,
      audienceDemographicsAvailable: ['COUNTRY'],
      unavailableDemographics: ['AGE', 'GENDER'],
    },
  };
};

module.exports = { getCampaignApplicantRanking, MAX_APPLICANTS, HISTORY_DAYS, VIEW_HOLD_DAYS };
