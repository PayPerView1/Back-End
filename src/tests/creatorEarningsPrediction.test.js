jest.mock('../models/campaign', () => ({ find: jest.fn() }));
jest.mock('../models/CreatorEarning', () => ({ aggregate: jest.fn() }));
jest.mock('../models/SubmissionViewSnapshot', () => ({ aggregate: jest.fn() }));
jest.mock('../services/ai/aiIntelligence.client', () => ({ predictCreatorEarnings: jest.fn() }));

const mongoose = require('mongoose');
const Campaign = require('../models/campaign');
const CreatorEarning = require('../models/CreatorEarning');
const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const { getCreatorEarningsPrediction, emptyPrediction } = require('../services/wallet/creatorEarningsPrediction.service');

const daysQuery = (value) => {
  const builder = { select: jest.fn(), lean: jest.fn().mockResolvedValue(value) };
  builder.select.mockReturnValue(builder);
  return builder;
};

describe('creator earnings prediction service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends only creator-owned matured validated view and confirmed ledger history with applicable campaign CPM', async () => {
    const creatorId = new mongoose.Types.ObjectId();
    const campaignId = new mongoose.Types.ObjectId();
    const historyDays = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];
    SubmissionViewSnapshot.aggregate.mockResolvedValue(historyDays.map((day, index) => ({
      _id: { campaignId, day }, validatedViews: 900 + (index * 50),
    })));
    CreatorEarning.aggregate.mockResolvedValue(historyDays.map((day, index) => ({
      _id: { campaignId, day }, validatedViews: 900 + (index * 50),
      confirmedGrossAmountCents: 450 + (index * 25), confirmedCreatorNetAmountCents: 405 + (index * 23),
    })));
    Campaign.find.mockReturnValue(daysQuery([{ _id: campaignId, cpm: 5 }]));
    const expected = { status: 'ESTIMATED', windowDays: 7, estimatedGrossAmountCents: 2000 };
    aiIntelligence.predictCreatorEarnings.mockResolvedValue(expected);
    const now = new Date('2026-11-10T12:00:00Z');

    const result = await getCreatorEarningsPrediction(String(creatorId), now);

    const viewMatch = SubmissionViewSnapshot.aggregate.mock.calls[0][0][0].$match;
    const ledgerMatch = CreatorEarning.aggregate.mock.calls[0][0][0].$match;
    expect(String(viewMatch.creatorId)).toBe(String(creatorId));
    expect(viewMatch.reviewStatus.$in).toEqual(['CLEAR', 'CONFIRMED']);
    expect(viewMatch.fetchStatus).toBe('OK');
    expect(viewMatch.capturedAt.$lt.toISOString()).toBe('2026-11-03T00:00:00.000Z');
    expect(viewMatch.capturedAt).not.toHaveProperty('$lte');
    expect(String(ledgerMatch.creatorId)).toBe(String(creatorId));
    expect(ledgerMatch.availableAt.$lte).toEqual(now);
    expect(ledgerMatch.status.$in).toContain('PAID');
    expect(Campaign.find).toHaveBeenCalledWith({ _id: { $in: [String(campaignId)] } });
    expect(aiIntelligence.predictCreatorEarnings).toHaveBeenCalledWith({
      asOfDate: '2026-11-10',
      campaigns: [{
        campaignId: String(campaignId), applicableCpm: 5,
        dailyHistory: historyDays.map((day, index) => ({
          day, validatedViews: 900 + (index * 50),
          confirmedGrossAmountCents: 450 + (index * 25), confirmedCreatorNetAmountCents: 405 + (index * 23),
        })),
      }],
    });
    expect(result).toEqual(expected);
  });

  test('returns an explicit no-history fallback without calling AI', async () => {
    SubmissionViewSnapshot.aggregate.mockResolvedValue([]);
    CreatorEarning.aggregate.mockResolvedValue([]);
    const result = await getCreatorEarningsPrediction(new mongoose.Types.ObjectId().toString());
    expect(result).toEqual(emptyPrediction('No matured, validated view and confirmed earning history is available for this creator.'));
    expect(aiIntelligence.predictCreatorEarnings).not.toHaveBeenCalled();
  });
});
