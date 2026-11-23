jest.mock('../models/submission', () => ({}));
jest.mock('../models/campaign', () => ({}));
jest.mock('../models/CreatorWallet', () => ({}));
jest.mock('../models/CreatorEarning', () => ({ aggregate: jest.fn() }));
jest.mock('../models/SubmissionViewSnapshot', () => ({ countDocuments: jest.fn(), find: jest.fn() }));
jest.mock('../services/social/socialMetadata.service', () => ({ fetchPostMetadata: jest.fn() }));
jest.mock('../services/notification/notification.service', () => ({ notifyUser: jest.fn() }));
jest.mock('../services/ai/aiIntelligence.client', () => ({ analyzeViews: jest.fn() }));

const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
const CreatorEarning = require('../models/CreatorEarning');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const { campaignViewIntelligence } = require('../services/submission/submissionViews.service');

const snapshotQuery = (documents) => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(documents),
});

describe('campaign view intelligence data integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the seven-day snapshot window and matured confirmed earnings ledger only', async () => {
    const now = new Date('2026-11-10T12:00:00.000Z');
    const recent = {
      submissionId: 'submission-1', capturedAt: new Date('2026-11-09T12:00:00Z'),
      deltaViews: 50, eligibleViews: 50, reviewStatus: 'CLEAR', flags: [],
      countryDeltaViews: [{ countryCode: 'JOR', views: 45 }, { countryCode: 'USA', views: 5 }],
    };
    SubmissionViewSnapshot.countDocuments.mockResolvedValue(1);
    SubmissionViewSnapshot.find.mockReturnValue(snapshotQuery([recent]));
    CreatorEarning.aggregate.mockResolvedValue([{ _id: '2026-11-01', validatedViews: 1000, confirmedGrossAmountCents: 500, confirmedCreatorNetAmountCents: 475 }]);
    aiIntelligence.analyzeViews.mockResolvedValue({ campaignId: 'campaign-1', windowDays: 7, status: 'AVAILABLE' });

    const result = await campaignViewIntelligence({ _id: 'campaign-1', cpm: 5, remainingBudget: 100, targetCountries: ['JOR'] }, now);

    expect(SubmissionViewSnapshot.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'campaign-1', fetchStatus: 'OK', capturedAt: expect.objectContaining({ $gte: new Date('2026-11-03T12:00:00.000Z'), $lte: now }),
    }));
    expect(CreatorEarning.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: expect.objectContaining({
        status: { $in: ['AVAILABLE', 'PARTIALLY_RESERVED', 'RESERVED', 'PAID'] },
        availableAt: { $lte: now },
      }) }),
    ]));
    expect(aiIntelligence.analyzeViews).toHaveBeenCalledWith(expect.objectContaining({
      cpm: 5, remainingBudget: 100, targetCountries: ['JOR'], events: [expect.objectContaining({ countryDeltas: recent.countryDeltaViews })],
      validatedHistory: [{ day: '2026-11-01', validatedViews: 1000, confirmedGrossAmountCents: 500, confirmedCreatorNetAmountCents: 475 }],
    }));
    expect(result.status).toBe('AVAILABLE');
  });

  it('returns a safe unavailable result when the AI service fails', async () => {
    SubmissionViewSnapshot.countDocuments.mockResolvedValue(0);
    SubmissionViewSnapshot.find.mockReturnValue(snapshotQuery([]));
    CreatorEarning.aggregate.mockResolvedValue([]);
    aiIntelligence.analyzeViews.mockRejectedValue(Object.assign(new Error('offline'), { code: 'AI_SERVICE_UNAVAILABLE' }));

    const result = await campaignViewIntelligence({ _id: 'campaign-1', cpm: 5 }, new Date());

    expect(result).toMatchObject({ status: 'UNAVAILABLE', windowDays: 7 });
    expect(result.earningsPrediction.status).toBe('INSUFFICIENT_DATA');
  });
});
