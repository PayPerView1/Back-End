const mongoose = require('mongoose');
const Submission = require('../../models/submission');
const SubmissionViewSnapshot = require('../../models/SubmissionViewSnapshot');
const Campaign = require('../../models/campaign');
const CreatorWallet = require('../../models/CreatorWallet');
const CreatorEarning = require('../../models/CreatorEarning');
const { fetchPostMetadata } = require('../social/socialMetadata.service');
const { AppError } = require('../../utils/errors');
const { SUBMISSION_STATUS, POST_FETCH_STATUS } = require('../../constants/submission.constants');
const { NOTIFICATION_TYPE } = require('../../constants/discovery.constants');
const { notifyUser } = require('../notification/notification.service');
const { buildNotification } = require('../notification/notification.templates');
const aiIntelligence = require('../ai/aiIntelligence.client');

const POLL_INTERVAL_MINUTES = Math.min(60, Math.max(5, Number(process.env.VIEW_POLL_INTERVAL_MINUTES) || 15));
const SOURCE_BY_PLATFORM = {
  YOUTUBE: 'YOUTUBE_DATA_API',
  TIKTOK: 'TIKTOK_OEMBED',
  INSTAGRAM: 'INSTAGRAM_GRAPH_API',
};
const MILESTONES = [10000, 50000, 100000];
const moneyCents = (amount) => Math.round(Number(amount || 0) * 100);
const money = (cents) => cents / 100;
const grossCentsForViews = (views, cpm) =>
  Math.floor((Number(views || 0) * Number(cpm || 0) / 10) + 1e-8);

const commissionRate = () => {
  const rate = Number(process.env.CREATOR_COMMISSION_RATE);
  return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : 0;
};

const hourThreshold = () => {
  const value = Number(process.env.MAX_VERIFIED_VIEWS_PER_HOUR);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const sourceSampleKey = (date) => {
  const intervalMs = POLL_INTERVAL_MINUTES * 60 * 1000;
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs).toISOString();
};

const normalizeCountryViews = (items) => (Array.isArray(items) ? items : [])
  .filter((item) => /^[A-Z]{3}$/.test(String(item.countryCode || '').toUpperCase()) && Number.isFinite(Number(item.views)) && Number(item.views) >= 0)
  .map((item) => ({ countryCode: String(item.countryCode).toUpperCase(), views: Math.floor(Number(item.views)) }));

const countryDelta = (current, previous) => {
  const before = new Map((previous || []).map((item) => [item.countryCode, Number(item.views) || 0]));
  return normalizeCountryViews(current).map((item) => ({
    countryCode: item.countryCode,
    views: Math.max(item.views - (before.get(item.countryCode) || 0), 0),
  }));
};

const mergeCountryHighWater = (current, previousHighWater) => {
  const highWater = new Map((previousHighWater || []).map((item) => [item.countryCode, Number(item.views) || 0]));
  for (const item of normalizeCountryViews(current)) {
    highWater.set(item.countryCode, Math.max(highWater.get(item.countryCode) || 0, item.views));
  }
  return [...highWater.entries()].map(([countryCode, views]) => ({ countryCode, views }));
};

const calculateViewDelta = (currentViews, highWaterViews, previousViews) => {
  if (currentViews === null || currentViews === undefined) {
    return { deltaViews: 0, highWaterViews: highWaterViews ?? previousViews ?? null, decreased: false };
  }
  const baseline = highWaterViews ?? previousViews ?? null;
  if (baseline === null) return { deltaViews: 0, highWaterViews: currentViews, decreased: false };
  return {
    deltaViews: Math.max(0, currentViews - baseline),
    highWaterViews: Math.max(baseline, currentViews),
    decreased: currentViews < baseline,
  };
};

const accrueSnapshot = async (snapshot, session) => {
  if (!['CLEAR', 'CONFIRMED'].includes(snapshot.reviewStatus) || snapshot.eligibleViews <= 0) return null;

  const [submission, campaign] = await Promise.all([
    Submission.findById(snapshot.submissionId).session(session),
    Campaign.findById(snapshot.campaignId).session(session),
  ]);
  if (!submission || submission.status !== SUBMISSION_STATUS.APPROVED || !campaign) return null;

  const accumulated = await SubmissionViewSnapshot.aggregate([
    {
      $match: {
        submissionId: snapshot.submissionId,
        capturedAt: { $lte: snapshot.capturedAt },
        reviewStatus: { $in: ['CLEAR', 'CONFIRMED'] },
      },
    },
    { $group: { _id: null, views: { $sum: '$eligibleViews' } } },
  ]).session(session);
  const accrued = await CreatorEarning.aggregate([
    {
      $match: {
        submissionId: snapshot.submissionId,
        createdAt: { $lte: snapshot.capturedAt },
        status: { $ne: 'REJECTED' },
      },
    },
    { $group: { _id: null, amountCents: { $sum: '$grossAmountCents' } } },
  ]).session(session);

  // تحويل CPM من الدولار إلى السنت: عدد المشاهدات × CPM × 100 ÷ 1000.
  const targetGrossCents = grossCentsForViews(accumulated[0]?.views, campaign.cpm);
  const alreadyAccruedCents = Number(accrued[0]?.amountCents || 0);
  const dueCents = Math.max(0, targetGrossCents - alreadyAccruedCents);
  if (dueCents <= 0) return null;

  const remainingBudgetCents = moneyCents(campaign.remainingBudget);
  const grossCents = Math.min(dueCents, remainingBudgetCents);
  if (grossCents <= 0) return null;

  const commissionCents = Math.round(grossCents * commissionRate());
  const netCents = grossCents - commissionCents;
  const hoursToHold = 7 * 24 * 60 * 60 * 1000;
  const availableAt = new Date(snapshot.capturedAt.getTime() + hoursToHold);

  await CreatorEarning.create([{
    creatorId: snapshot.creatorId,
    campaignId: snapshot.campaignId,
    submissionId: snapshot.submissionId,
    snapshotId: snapshot._id,
    views: snapshot.eligibleViews,
    grossAmountCents: grossCents,
    commissionCents,
    netAmountCents: netCents,
    currency: 'USD',
    status: 'ON_HOLD',
    availableAt,
    unreservedAmountCents: 0,
  }], { session });

  let wallet = await CreatorWallet.findOne({ creatorId: snapshot.creatorId }).session(session);
  if (!wallet) {
    [wallet] = await CreatorWallet.create([{ creatorId: snapshot.creatorId, currency: 'USD' }], { session });
  }
  await CreatorWallet.updateOne(
    { _id: wallet._id },
    { $inc: { pendingBalanceCents: netCents, totalEarningsCents: netCents } },
    { session }
  );

  const nextRemainingCents = remainingBudgetCents - grossCents;
  const budgetUpdate = await Campaign.updateOne(
    { _id: campaign._id, remainingBudget: { $gte: money(grossCents) } },
    {
      $set: { remainingBudget: money(nextRemainingCents) },
      $inc: {
        budgetSpent: money(grossCents),
        'stats.totalSpent': money(grossCents),
      },
    },
    { session }
  );
  if (budgetUpdate.modifiedCount !== 1) throw new AppError('Campaign budget changed during earnings calculation', 'CONFLICT');
  return { grossAmount: money(grossCents), netAmount: money(netCents), availableAt };
};

const sampleSubmission = async (submissionId, now = new Date()) => {
  const submission = await Submission.findOne({ _id: submissionId, status: SUBMISSION_STATUS.APPROVED })
    .select('_id campaignId creatorId platform canonicalUrl externalId')
    .lean();
  if (!submission) return { skipped: true, reason: 'NOT_APPROVED' };

  const metadata = await fetchPostMetadata({
    platform: submission.platform,
    canonicalUrl: submission.canonicalUrl,
    externalId: submission.externalId,
  });
  const sampleKey = sourceSampleKey(now);
  const session = await mongoose.startSession();
  let created;
  let earnings;
  let milestoneNotifications = [];

  try {
    await session.withTransaction(async () => {
      created = undefined;
      earnings = undefined;
      milestoneNotifications = [];
      const current = await Submission.findOne({
        _id: submission._id,
        status: SUBMISSION_STATUS.APPROVED,
      }).session(session);
      if (!current) return;

      const duplicate = await SubmissionViewSnapshot.exists({ submissionId: current._id, sampleKey }).session(session);
      if (duplicate) return;
      const previous = await SubmissionViewSnapshot.findOne({
        submissionId: current._id,
        fetchStatus: POST_FETCH_STATUS.OK,
        views: { $ne: null },
      }).sort({ capturedAt: -1 }).session(session).lean();
      const campaign = await Campaign.findById(current.campaignId).session(session);
      if (!campaign) return;

      const stats = metadata.fetchStatus === POST_FETCH_STATUS.OK ? metadata.stats : null;
      const currentViews = stats?.views ?? null;
      let deltaViews = 0;
      const flags = [];
      let deltaCountries = [];
      const previousHighWaterViews = calculateViewDelta(
        null,
        current.viewTrackingHighWaterViews,
        previous?.views
      ).highWaterViews;
      const viewDelta = calculateViewDelta(currentViews, current.viewTrackingHighWaterViews, previous?.views);
      deltaViews = viewDelta.deltaViews;
      if (viewDelta.decreased) flags.push('VIEW_COUNT_DECREASED');
      const hasPreviousCountryBaseline = current.viewTrackingHighWaterCountryViews.length > 0 || Boolean(previous);
      const previousHighWaterCountries = current.viewTrackingHighWaterCountryViews.length
        ? current.viewTrackingHighWaterCountryViews
        : previous?.countryViews || [];
      if (currentViews !== null && hasPreviousCountryBaseline) {
        deltaCountries = countryDelta(stats.countryViews, previousHighWaterCountries);
        const targetCountries = new Set((campaign.targetCountries || []).map((country) => String(country).toUpperCase()));
        const outOfTargetViews = deltaCountries
          .filter((item) => !targetCountries.has(item.countryCode))
          .reduce((sum, item) => sum + item.views, 0);
        if (outOfTargetViews > 0) flags.push('OUT_OF_TARGET_COUNTRY');
        if (deltaViews > 0 && previous?.capturedAt) {
          const hours = Math.max((now.getTime() - new Date(previous.capturedAt).getTime()) / 3600000, 1 / 60);
          const maxPerHour = hourThreshold();
          if (maxPerHour && deltaViews / hours > maxPerHour) flags.push('RAPID_VIEW_GROWTH');
        }
      }

      const currentCountryViews = normalizeCountryViews(stats?.countryViews);
      const countryDeltas = hasPreviousCountryBaseline ? deltaCountries : [];
      const targetCountries = new Set((campaign.targetCountries || []).map((country) => String(country).toUpperCase()));
      const outOfTargetViews = countryDeltas
        .filter((item) => !targetCountries.has(item.countryCode))
        .reduce((sum, item) => sum + item.views, 0);
      const eligibleViews = Math.max(deltaViews - outOfTargetViews, 0);

      [created] = await SubmissionViewSnapshot.create([{
        submissionId: current._id,
        campaignId: current.campaignId,
        creatorId: current.creatorId,
        platform: current.platform,
        sampleKey,
        source: SOURCE_BY_PLATFORM[current.platform],
        fetchStatus: metadata.fetchStatus,
        views: currentViews,
        likes: stats?.likes ?? null,
        comments: stats?.comments ?? null,
        shares: stats?.shares ?? null,
        deltaViews,
        eligibleViews,
        countryViews: currentCountryViews,
        countryDeltaViews: hasPreviousCountryBaseline ? deltaCountries : [],
        flags: [...new Set(flags)],
        reviewStatus: flags.length ? 'REVIEW_REQUIRED' : 'CLEAR',
        capturedAt: now,
      }], { session });

      if (deltaViews > 0) {
        await Campaign.updateOne({ _id: campaign._id }, { $inc: { 'stats.totalViews': deltaViews } }, { session });
      }

      if (currentViews !== null) {
        const alreadyNotified = new Set(current.viewTrackingMilestonesNotified || []);
        milestoneNotifications = MILESTONES.filter((milestone) =>
          (previousHighWaterViews ?? 0) < milestone && currentViews >= milestone && !alreadyNotified.has(milestone)
        );
        const update = {
          $set: {
            viewTrackingHighWaterViews: viewDelta.highWaterViews,
            viewTrackingHighWaterCountryViews: mergeCountryHighWater(
              stats?.countryViews,
              previousHighWaterCountries
            ),
          },
        };
        if (milestoneNotifications.length) {
          update.$addToSet = { viewTrackingMilestonesNotified: { $each: milestoneNotifications } };
        }
        await Submission.updateOne({ _id: current._id }, update, { session });
      }

      if (!flags.length && eligibleViews > 0) earnings = await accrueSnapshot(created, session);
    });
  } catch (error) {
    if (error.code === 11000) return { skipped: true, reason: 'DUPLICATE_SAMPLE' };
    throw error;
  } finally {
    await session.endSession();
  }

  for (const views of milestoneNotifications) {
    await notifyUser(
      submission.creatorId,
      buildNotification(NOTIFICATION_TYPE.EARNINGS_MILESTONE, { views }, {
        submissionId: String(submission._id),
        campaignId: String(submission.campaignId),
        views,
      })
    );
  }
  return { skipped: !created, snapshotId: created?._id || null, fetchStatus: metadata.fetchStatus, earnings: earnings || null };
};

const runViewTracking = async ({ limit = 200, now = new Date() } = {}) => {
  const submissions = await Submission.find({ status: SUBMISSION_STATUS.APPROVED })
    .sort({ viewTrackingPolledAt: 1, approvedAt: 1, _id: 1 })
    .limit(limit)
    .select('_id')
    .lean();
  let sampled = 0;
  let skipped = 0;
  for (const submission of submissions) {
    try {
      const result = await sampleSubmission(submission._id, now);
      if (result.skipped) skipped += 1;
      else sampled += 1;
    } catch (error) {
      console.error(`[submissionViews] sample failed for ${submission._id}: ${error.message}`);
    } finally {
      try {
        await Submission.updateOne(
          { _id: submission._id, status: SUBMISSION_STATUS.APPROVED },
          { $set: { viewTrackingPolledAt: now } }
        );
      } catch (error) {
        console.error(`[submissionViews] polling cursor update failed for ${submission._id}: ${error.message}`);
      }
    }
  }
  return { candidates: submissions.length, sampled, skipped };
};

const getSubmissionViews = async (submissionId, userId, { page = 1, perPage = 20 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(submissionId)) throw new AppError('Submission not found', 'NOT_FOUND');
  const submission = await Submission.findById(submissionId).populate('campaignId', 'advertiserId').lean();
  if (!submission || (
    submission.creatorId.toString() !== userId.toString() &&
    submission.campaignId?.advertiserId?.toString() !== userId.toString()
  )) throw new AppError('Submission not found', 'NOT_FOUND');

  const filter = { submissionId };
  const [items, total] = await Promise.all([
    SubmissionViewSnapshot.find(filter).sort({ capturedAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    SubmissionViewSnapshot.countDocuments(filter),
  ]);
  const earnings = items.length
    ? await CreatorEarning.find({ snapshotId: { $in: items.map((item) => item._id) } }).lean()
    : [];
  const earningsBySnapshot = new Map(earnings.map((item) => [String(item.snapshotId), item]));
  return {
    data: items.map((item) => {
      const earning = earningsBySnapshot.get(String(item._id));
      return {
        ...item,
        earnings: earning ? {
          grossAmount: money(earning.grossAmountCents),
          commission: money(earning.commissionCents),
          netAmount: money(earning.netAmountCents),
          amountDue: money(Math.max(earning.netAmountCents - earning.paidAmountCents, 0)),
          status: earning.status,
          availableAt: earning.availableAt,
        } : null,
      };
    }),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  };
};

const latestCampaignSnapshots = async (campaignId) => SubmissionViewSnapshot.aggregate([
  { $match: { campaignId: new mongoose.Types.ObjectId(campaignId) } },
  { $sort: { capturedAt: -1 } },
  { $group: { _id: '$submissionId', snapshot: { $first: '$$ROOT' } } },
  { $replaceRoot: { newRoot: '$snapshot' } },
]);

const emptyViewIntelligence = (reason) => ({
  status: 'UNAVAILABLE',
  windowDays: 7,
  explanation: reason,
  futureViewPrediction: { status: 'INSUFFICIENT_DATA', predictedNext7DaysViews: null, confidence: 0, explanation: reason },
  earningsPrediction: { status: 'INSUFFICIENT_DATA', estimatedGrossAmountCents: null, currency: 'USD', confidence: 0, explanation: 'Confirmed ledger, matured validation, or CPM history is insufficient.' },
});

const campaignViewIntelligence = async (campaign, now = new Date()) => {
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const historyFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [eventCount, snapshots, earningHistory] = await Promise.all([
    SubmissionViewSnapshot.countDocuments({ campaignId: campaign._id, capturedAt: { $gte: from, $lte: now }, fetchStatus: POST_FETCH_STATUS.OK }),
    SubmissionViewSnapshot.find({ campaignId: campaign._id, capturedAt: { $gte: from, $lte: now }, fetchStatus: POST_FETCH_STATUS.OK })
      .sort({ capturedAt: 1, _id: 1 }).limit(5001)
      .select('submissionId capturedAt deltaViews eligibleViews reviewStatus flags countryDeltaViews').lean(),
    CreatorEarning.aggregate([
      { $match: {
        campaignId: campaign._id,
        createdAt: { $gte: historyFrom, $lte: now },
        availableAt: { $lte: now },
        status: { $in: ['AVAILABLE', 'PARTIALLY_RESERVED', 'RESERVED', 'PAID'] },
      } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
        validatedViews: { $sum: '$views' },
        confirmedGrossAmountCents: { $sum: '$grossAmountCents' },
        confirmedCreatorNetAmountCents: { $sum: '$netAmountCents' },
      } },
      { $sort: { _id: 1 } },
      { $limit: 90 },
    ]),
  ]);

  // Do not silently send a truncated history and present the resulting statistics as complete.
  if (eventCount > 5000 || snapshots.length > 5000) {
    return emptyViewIntelligence('The seven-day event volume exceeds the analysis limit; no partial prediction was returned.');
  }
  const payload = {
    campaignId: String(campaign._id),
    cpm: Number.isFinite(Number(campaign.cpm)) ? Number(campaign.cpm) : null,
    remainingBudget: Number.isFinite(Number(campaign.remainingBudget)) ? Math.max(0, Number(campaign.remainingBudget)) : null,
    targetCountries: (campaign.targetCountries || []).map((country) => String(country).toUpperCase()),
    events: snapshots.map((item) => ({
      submissionId: String(item.submissionId),
      capturedAt: item.capturedAt.toISOString(),
      deltaViews: Math.max(0, Number(item.deltaViews) || 0),
      eligibleViews: Math.max(0, Number(item.eligibleViews) || 0),
      reviewStatus: item.reviewStatus,
      flags: item.flags || [],
      countryDeltas: (item.countryDeltaViews || []).map((country) => ({
        countryCode: String(country.countryCode).toUpperCase(),
        views: Math.max(0, Number(country.views) || 0),
      })),
    })),
    validatedHistory: earningHistory.map((item) => ({
      day: item._id,
      validatedViews: Math.max(0, Number(item.validatedViews) || 0),
      confirmedGrossAmountCents: Math.max(0, Number(item.confirmedGrossAmountCents) || 0),
      confirmedCreatorNetAmountCents: Math.max(0, Number(item.confirmedCreatorNetAmountCents) || 0),
    })),
  };
  try {
    const result = await aiIntelligence.analyzeViews(payload);
    return { status: 'AVAILABLE', ...result };
  } catch (error) {
    console.warn(`[submissionViews] campaign intelligence unavailable (code=${error.code || 'UNKNOWN'})`);
    return emptyViewIntelligence('Seven-day view intelligence is temporarily unavailable.');
  }
};

const getCampaignAnalytics = async (campaignId, advertiserId) => {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) throw new AppError('Campaign not found', 'NOT_FOUND');
  const campaign = await Campaign.findOne({ _id: campaignId, advertiserId }).lean();
  if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');

  const [snapshots, approved, creators] = await Promise.all([
    latestCampaignSnapshots(campaignId),
    Submission.countDocuments({ campaignId, status: SUBMISSION_STATUS.APPROVED }),
    Submission.distinct('creatorId', { campaignId, status: SUBMISSION_STATUS.APPROVED }),
  ]);
  const available = snapshots.filter((item) => item.fetchStatus === POST_FETCH_STATUS.OK && item.views !== null);
  const geography = new Map();
  for (const snapshot of available) {
    for (const item of snapshot.countryViews || []) {
      geography.set(item.countryCode, (geography.get(item.countryCode) || 0) + item.views);
    }
  }

  const viewIntelligence = await campaignViewIntelligence(campaign);
  return {
    campaignId: campaign._id,
    status: campaign.status,
    totalViews: available.reduce((sum, item) => sum + item.views, 0),
    approvedVideos: approved,
    participatingCreators: creators.length,
    amountSpent: campaign.stats?.totalSpent || 0,
    remainingBudget: campaign.remainingBudget,
    viewsAvailable: available.length > 0,
    geographyAvailable: geography.size > 0,
    viewsByCountry: [...geography.entries()].map(([countryCode, views]) => ({ countryCode, views })),
    viewIntelligence,
    generatedAt: new Date(),
  };
};

const listReviewQueue = async ({ page = 1, perPage = 20 } = {}) => {
  const filter = { reviewStatus: 'REVIEW_REQUIRED' };
  const [data, total] = await Promise.all([
    SubmissionViewSnapshot.find(filter).sort({ capturedAt: 1 }).skip((page - 1) * perPage).limit(perPage)
      .populate('campaignId', 'name advertiserId')
      .populate('creatorId', 'fullName email')
      .lean(),
    SubmissionViewSnapshot.countDocuments(filter),
  ]);
  return { data, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
};

const reviewSnapshot = async (snapshotId, adminId, { decision }) => {
  if (!mongoose.Types.ObjectId.isValid(snapshotId)) throw new AppError('View snapshot not found', 'NOT_FOUND');
  const session = await mongoose.startSession();
  let snapshot;
  let earnings;
  try {
    await session.withTransaction(async () => {
      snapshot = await SubmissionViewSnapshot.findOneAndUpdate(
        { _id: snapshotId, reviewStatus: 'REVIEW_REQUIRED' },
        {
          $set: {
            reviewStatus: decision === 'CONFIRM' ? 'CONFIRMED' : 'DISMISSED',
            reviewedBy: adminId,
            reviewedAt: new Date(),
          },
        },
        { new: true, session }
      );
      if (!snapshot) throw new AppError('View snapshot is not awaiting review', 'SUBMISSION_ALREADY_REVIEWED');
      if (decision === 'CONFIRM') earnings = await accrueSnapshot(snapshot, session);
    });
  } finally {
    await session.endSession();
  }
  return { id: snapshot._id, reviewStatus: snapshot.reviewStatus, earnings: earnings || null };
};

module.exports = {
  runViewTracking,
  sampleSubmission,
  getSubmissionViews,
  getCampaignAnalytics,
  listReviewQueue,
  reviewSnapshot,
  POLL_INTERVAL_MINUTES,
  grossCentsForViews,
  countryDelta,
  mergeCountryHighWater,
  calculateViewDelta,
  campaignViewIntelligence,
};
