jest.mock('../models/campaign', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/CampaignDraft', () => ({ find: jest.fn() }));
jest.mock('../models/CampaignBudgetSnapshot', () => ({ aggregate: jest.fn(), find: jest.fn() }));
jest.mock('../models/wallet', () => ({ findOne: jest.fn() }));
jest.mock('../models/transaction', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/refundRequest', () => ({ find: jest.fn() }));
jest.mock('../models/submission', () => ({ aggregate: jest.fn() }));
jest.mock('../services/ai/aiIntelligence.client', () => ({ analyzeDraft: jest.fn(), analyzeCampaign: jest.fn(), analyzeBudget: jest.fn(), detectLanguage: jest.fn(), translateText: jest.fn() }));

const Campaign = require('../models/campaign');
const CampaignDraft = require('../models/CampaignDraft');
const CampaignBudgetSnapshot = require('../models/CampaignBudgetSnapshot');
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');
const RefundRequest = require('../models/refundRequest');
const Submission = require('../models/submission');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const controller = require('../controllers/ai/intelligence.controller');

const chain = (result) => {
  const query = {
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(result),
  };
  return query;
};

const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('AI intelligence controller data boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CampaignDraft.find.mockReturnValue(chain([]));
    Campaign.find.mockImplementation((filter) => chain(filter.$or || filter.status === 'COMPLETED' ? [
      { _id: 'old-campaign', name: 'Completed', contentType: 'UGC', category: 'UGC', totalBudget: 100, stats: { totalViews: 1000, totalSpent: 50 }, status: 'COMPLETED' },
    ] : [
      { _id: 'owned-campaign', name: 'Owned', contentType: 'UGC', category: 'UGC', totalBudget: 100, remainingBudget: 60, stats: {}, status: 'ACTIVE' },
    ]));
    Campaign.findOne.mockReturnValue(chain({ _id: 'owned-campaign', advertiserId: 'brand-a', remainingBudget: 60, name: 'Owned', stats: {} }));
    CampaignBudgetSnapshot.find.mockReturnValue(chain([
      { dailySpend: 10, day: new Date('2026-11-01T00:00:00Z') },
      { dailySpend: 20, day: new Date('2026-11-02T00:00:00Z') },
      { dailySpend: 10, day: new Date('2026-11-03T00:00:00Z') },
    ]));
    Wallet.findOne.mockReturnValue(chain({ _id: 'wallet-a', lastPaymentMethod: 'BANK_TRANSFER' }));
    Transaction.find.mockReturnValue(chain([{ grossAmount: 100, netAmount: 100, type: 'CREDIT', status: 'COMPLETED', paymentMethod: 'PAYPAL', createdAt: new Date() }]));
    Transaction.findOne.mockReturnValue(chain({ paymentMethod: 'PAYPAL' }));
    RefundRequest.find.mockReturnValue(chain([{ amount: 20, status: 'PENDING', refundMethod: 'PAYPAL' }]));
    CampaignBudgetSnapshot.aggregate.mockResolvedValue([{ _id: new Date(), amount: 40 }]);
    aiIntelligence.analyzeBudget.mockResolvedValue({ result: 'real-statistics-only' });
    Submission.aggregate.mockResolvedValue([{ totalSubmissions: 4, acceptedSubmissions: 3 }]);
  });

  afterEach(() => {
    delete process.env.PAYMENT_METHODS_BY_COUNTRY;
  });

  it('scopes campaign, wallet, payment, and daily budget data to the authenticated brand', async () => {
    const req = { user: { _id: 'brand-a', country: 'JO' }, body: { campaignId: '64b000000000000000000001', transactionId: '64b000000000000000000002', amount: 100 } };
    const res = response();
    await controller.analyzeWallet(req, res);

    expect(Campaign.find.mock.calls.every(([filter]) => filter.advertiserId === 'brand-a')).toBe(true);
    expect(Campaign.findOne).toHaveBeenCalledWith(expect.objectContaining({ advertiserId: 'brand-a' }));
    expect(Wallet.findOne).toHaveBeenCalledWith({ advertiserId: 'brand-a' });
    expect(Transaction.find).toHaveBeenCalledWith({ walletId: 'wallet-a' });
    expect(Transaction.findOne).toHaveBeenCalledWith(expect.objectContaining({ walletId: 'wallet-a', type: 'CREDIT', status: 'COMPLETED' }));
    expect(CampaignBudgetSnapshot.find).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'owned-campaign' }));
    expect(aiIntelligence.analyzeBudget.mock.calls[0][0]).toEqual(expect.objectContaining({
      refundOriginalMethod: 'PAYPAL',
      dailySpending: [10, 20, 10],
      campaign: expect.objectContaining({ id: 'owned-campaign', remainingBudget: 60 }),
      campaigns: [expect.objectContaining({ id: 'old-campaign' })],
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sends an owned draft and same-owner peers to AI without declaration metadata', async () => {
    aiIntelligence.analyzeDraft.mockResolvedValue({ policyDecision: 'MANUAL_REVIEW_REQUIRED' });
    const draft = {
      _id: 'draft-a',
      toObject: () => ({
        _id: 'draft-a', name: 'Owned draft', brief: { mainIdea: 'Show a product' },
        halalDeclaration: { noAlcohol: true, declaredBy: 'private-user', ipAddress: 'private-network-address' },
      }),
    };
    const res = response();
    await controller.analyzeDraft({ user: { _id: 'brand-a' }, draft }, res);

    expect(CampaignDraft.find).toHaveBeenCalledWith({ advertiserId: 'brand-a', _id: { $ne: 'draft-a' }, status: 'DRAFT' });
    const aiPayload = aiIntelligence.analyzeDraft.mock.calls[0][0];
    expect(aiPayload.draft.halalDeclaration).not.toHaveProperty('declaredBy');
    expect(aiPayload.draft.halalDeclaration).not.toHaveProperty('ipAddress');
    expect(aiPayload).not.toHaveProperty('campaignHistory');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sends only the authenticated brand campaign outcomes for performance analysis', async () => {
    aiIntelligence.analyzeCampaign.mockResolvedValue({ performancePrediction: { status: 'INSUFFICIENT_DATA' } });
    Campaign.find.mockReturnValue(chain([{
      _id: 'historical-campaign', name: 'Completed', contentType: 'UGC', category: 'UGC',
      totalBudget: 100, stats: { totalViews: 1000, totalSpent: 50 }, status: 'COMPLETED',
    }]));
    const current = {
      _id: 'current-campaign',
      toObject: () => ({
        _id: 'current-campaign', advertiserId: 'brand-a', name: 'Current', contentType: 'UGC', category: 'UGC',
        totalBudget: 200, remainingBudget: 180, stats: {}, status: 'ACTIVE',
      }),
    };
    const res = response();
    await controller.analyzeCampaign({ user: { _id: 'brand-a' }, campaign: current }, res);

    expect(Campaign.find).toHaveBeenCalledWith(expect.objectContaining({ advertiserId: 'brand-a', $or: [{ status: { $in: ['COMPLETED', 'ARCHIVED'] } }, { isArchived: true }] }));
    expect(aiIntelligence.analyzeCampaign.mock.calls[0][0].campaign.id).toBe('current-campaign');
    expect(aiIntelligence.analyzeCampaign.mock.calls[0][0].history[0].id).toBe('historical-campaign');
    expect(Submission.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: { campaignId: { $in: ['current-campaign', 'historical-campaign'] } } }),
    ]));
    expect(aiIntelligence.analyzeCampaign.mock.calls[0][0].policyAcceptance).toEqual({ totalSubmissions: 4, acceptedSubmissions: 3 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not analyze a campaign owned by another advertiser', async () => {
    Campaign.findOne.mockReturnValue(chain(null));
    const req = { user: { _id: 'brand-a' }, body: { campaignId: '64b000000000000000000099' } };
    const res = response();
    await controller.analyzeWallet(req, res);

    expect(aiIntelligence.analyzeBudget).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
