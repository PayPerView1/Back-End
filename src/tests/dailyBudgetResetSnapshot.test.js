jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../models/campaign', () => ({ find: jest.fn(), updateMany: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/CampaignActivityLog', () => ({ create: jest.fn() }));
jest.mock('../models/CampaignBudgetSnapshot', () => ({ bulkWrite: jest.fn() }));

const Campaign = require('../models/campaign');
const CampaignBudgetSnapshot = require('../models/CampaignBudgetSnapshot');
const { runDailyBudgetReset } = require('../jobs/dailyBudgetReset.job');

const chain = (result) => {
  const query = {
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(result),
  };
  return query;
};

describe('daily budget snapshot refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Campaign.find.mockImplementation((filter) => {
      if (filter.dailyBudgetResetAt) {
        return chain([{
          _id: 'campaign-a', dailyBudgetSpent: 14.5, remainingBudget: 70, dailyBudgetLimit: 30,
          totalBudget: 100, category: 'UGC', contentType: 'UGC',
        }]);
      }
      return Promise.resolve([]);
    });
    Campaign.updateMany.mockResolvedValue({ modifiedCount: 1 });
    CampaignBudgetSnapshot.bulkWrite.mockResolvedValue({ upsertedCount: 1 });
  });

  it('persists the real completed UTC-day values idempotently before resetting', async () => {
    await runDailyBudgetReset();

    const [operations, options] = CampaignBudgetSnapshot.bulkWrite.mock.calls[0];
    expect(options).toEqual({ ordered: false });
    expect(operations[0].updateOne.upsert).toBe(true);
    expect(operations[0].updateOne.filter).toEqual({ campaignId: 'campaign-a', day: expect.any(Date) });
    expect(operations[0].updateOne.update.$setOnInsert).toEqual(expect.objectContaining({
      dailySpend: 14.5,
      remainingBudget: 70,
      dailyBudgetLimit: 30,
      totalBudget: 100,
      category: 'UGC',
      contentType: 'UGC',
    }));
    expect(Campaign.updateMany).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }), expect.objectContaining({ $set: expect.objectContaining({ dailyBudgetSpent: 0 }) }));
  });

  it('does not synthesize a snapshot when the completed day was missed', async () => {
    Campaign.find.mockImplementation((filter) => filter.dailyBudgetResetAt ? chain([]) : Promise.resolve([]));
    await runDailyBudgetReset();
    expect(CampaignBudgetSnapshot.bulkWrite).not.toHaveBeenCalled();
    expect(Campaign.updateMany).toHaveBeenCalled();
  });
});
