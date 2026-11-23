require('dotenv').config();

const db = require('./helpers/db');
const f = require('./helpers/factories');
const Campaign = require('../models/campaign');
const CreatorWallet = require('../models/CreatorWallet');
const CreatorEarning = require('../models/CreatorEarning');
const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
const creatorEarningsService = require('../services/wallet/creatorEarnings.service');

jest.mock('../services/social/socialMetadata.service', () => ({
  fetchPostMetadata: jest.fn(),
}));
jest.mock('../services/notification/notification.service', () => ({
  notifyUser: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/ai/aiIntelligence.client', () => ({ analyzeViews: jest.fn() }));

const { fetchPostMetadata } = require('../services/social/socialMetadata.service');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const viewsService = require('../services/submission/submissionViews.service');

jest.setTimeout(120000);
beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
  delete process.env.MAX_VERIFIED_VIEWS_PER_HOUR;
});

const setupApproved = async () => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, { cpm: 5, totalBudget: 100, remainingBudget: 100 });
  const application = await f.createAcceptedApplication(creator, campaign);
  const submission = await f.createSubmission({ creator, campaign, application }, {
    platform: 'YOUTUBE',
    postUrl: 'https://www.youtube.com/shorts/abcdefghijk',
    canonicalUrl: 'https://www.youtube.com/shorts/abcdefghijk',
    externalId: 'abcdefghijk',
    status: 'APPROVED',
    approvedAt: new Date(),
  });
  return { brand, creator, campaign, submission };
};

const okStats = (views, countryViews = []) => ({
  fetchStatus: 'OK',
  stats: { views, likes: 1, comments: 0, shares: null, countryViews },
});

test('uses the first successful platform count as a baseline, then accrues verified deltas with a seven-day hold', async () => {
  const ctx = await setupApproved();
  const base = new Date('2026-01-01T00:00:00.000Z');
  fetchPostMetadata.mockResolvedValueOnce(okStats(500));
  const baseline = await viewsService.sampleSubmission(ctx.submission._id, base);
  expect(baseline.snapshotId).toBeTruthy();

  fetchPostMetadata.mockResolvedValueOnce(okStats(1500));
  const next = await viewsService.sampleSubmission(ctx.submission._id, new Date(base.getTime() + 15 * 60000));

  expect(next.earnings.grossAmount).toBe(5);
  const snapshot = await SubmissionViewSnapshot.findById(next.snapshotId);
  expect(snapshot.deltaViews).toBe(1000);
  expect(snapshot.eligibleViews).toBe(1000);
  const wallet = await CreatorWallet.findOne({ creatorId: ctx.creator._id });
  expect(wallet.pendingBalanceCents).toBe(500);
  expect(wallet.availableBalanceCents).toBe(0);
  const campaign = await Campaign.findById(ctx.campaign._id);
  expect(campaign.remainingBudget).toBe(95);
  expect(campaign.stats.totalViews).toBe(1000);
  const history = await viewsService.getSubmissionViews(ctx.submission._id, ctx.creator._id);
  expect(history.data[0].earnings).toMatchObject({
    grossAmount: 5,
    commission: 0,
    netAmount: 5,
    amountDue: 5,
    status: 'ON_HOLD',
  });

  const released = await creatorEarningsService.releaseDueEarnings(new Date(base.getTime() + 8 * 86400000));
  expect(released).toEqual({ processed: 1, released: 1 });
  const walletAfterHold = await CreatorWallet.findOne({ creatorId: ctx.creator._id });
  expect(walletAfterHold.pendingBalanceCents).toBe(0);
  expect(walletAfterHold.availableBalanceCents).toBe(500);
});

test('flags out-of-target viewer-country deltas and only accrues them after admin confirmation', async () => {
  const ctx = await setupApproved();
  const base = new Date('2026-02-01T00:00:00.000Z');
  fetchPostMetadata.mockResolvedValueOnce(okStats(1000, [{ countryCode: 'SAU', views: 1000 }]));
  await viewsService.sampleSubmission(ctx.submission._id, base);

  fetchPostMetadata.mockResolvedValueOnce(okStats(3000, [
    { countryCode: 'SAU', views: 1500 },
    { countryCode: 'USA', views: 1500 },
  ]));
  const result = await viewsService.sampleSubmission(ctx.submission._id, new Date(base.getTime() + 15 * 60000));
  const snapshot = await SubmissionViewSnapshot.findById(result.snapshotId);
  expect(snapshot.reviewStatus).toBe('REVIEW_REQUIRED');
  expect(snapshot.flags).toContain('OUT_OF_TARGET_COUNTRY');
  expect(snapshot.eligibleViews).toBe(500);
  expect(snapshot.countryDeltaViews).toEqual(expect.arrayContaining([
    expect.objectContaining({ countryCode: 'SAU', views: 500 }),
    expect.objectContaining({ countryCode: 'USA', views: 1500 }),
  ]));
  expect(await CreatorEarning.countDocuments()).toBe(0);

  await viewsService.reviewSnapshot(snapshot._id, ctx.brand._id, { decision: 'CONFIRM' });
  const earning = await CreatorEarning.findOne({ submissionId: ctx.submission._id });
  expect(earning.grossAmountCents).toBe(250);
  expect(earning.status).toBe('ON_HOLD');
});

test('does not create view totals or earnings when the provider has no stats', async () => {
  const ctx = await setupApproved();
  fetchPostMetadata.mockResolvedValue({ fetchStatus: 'UNAVAILABLE', stats: null });

  const result = await viewsService.sampleSubmission(ctx.submission._id, new Date('2026-03-01T00:00:00Z'));

  expect(result.fetchStatus).toBe('UNAVAILABLE');
  expect(await CreatorEarning.countDocuments()).toBe(0);
  expect((await Campaign.findById(ctx.campaign._id)).stats.totalViews).toBe(0);
});

test('campaign analytics sends only seven days of snapshot deltas and exposes AI insights', async () => {
  const ctx = await setupApproved();
  const now = new Date();
  const common = {
    campaignId: ctx.campaign._id,
    creatorId: ctx.creator._id,
    submissionId: ctx.submission._id,
    platform: 'YOUTUBE',
    source: 'YOUTUBE_DATA_API',
    fetchStatus: 'OK',
    views: 100,
    likes: 1,
    comments: 0,
    shares: null,
    deltaViews: 20,
    eligibleViews: 20,
    reviewStatus: 'CLEAR',
    flags: [],
  };
  await SubmissionViewSnapshot.create([
    { ...common, sampleKey: 'recent', capturedAt: new Date(now.getTime() - 2 * 86400000), countryViews: [{ countryCode: 'JOR', views: 100 }], countryDeltaViews: [{ countryCode: 'JOR', views: 20 }] },
    { ...common, sampleKey: 'older-than-window', capturedAt: new Date(now.getTime() - 8 * 86400000), countryViews: [{ countryCode: 'JOR', views: 80 }], countryDeltaViews: [{ countryCode: 'JOR', views: 20 }] },
  ]);
  aiIntelligence.analyzeViews.mockResolvedValue({ campaignId: String(ctx.campaign._id), windowDays: 7, status: 'AVAILABLE' });

  const result = await viewsService.getCampaignAnalytics(ctx.campaign._id, ctx.brand._id);

  expect(aiIntelligence.analyzeViews).toHaveBeenCalledTimes(1);
  const payload = aiIntelligence.analyzeViews.mock.calls[0][0];
  expect(payload.events).toHaveLength(1);
  expect(payload.events[0].countryDeltas).toEqual([{ countryCode: 'JOR', views: 20 }]);
  expect(payload.validatedHistory).toEqual([]);
  expect(result.viewIntelligence.status).toBe('AVAILABLE');
});
