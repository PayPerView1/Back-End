jest.mock('../models/campaign', () => ({ find: jest.fn() }));
jest.mock('../models/application', () => ({ find: jest.fn() }));
jest.mock('../models/favorite', () => ({ find: jest.fn() }));
jest.mock('../models/creatorPreferences', () => ({ findOne: jest.fn() }));
jest.mock('../services/ai/aiIntelligence.client', () => ({ rankRecommendations: jest.fn() }));

const Campaign = require('../models/campaign');
const Application = require('../models/application');
const Favorite = require('../models/favorite');
const CreatorPreferences = require('../models/creatorPreferences');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const { getRecommendations } = require('../services/campaign/campaignRecommendation.service');

const campaign = (id, contentType = 'UGC') => ({
  _id: id,
  name: `${contentType} campaign`,
  contentType,
  category: contentType,
  subCategories: [],
  brief: { mainIdea: `Make a ${contentType} product story`, keyMessages: 'Use the product', keywords: ['product'] },
  targetCountries: ['JOR'],
  cpm: 2,
  remainingBudget: 50,
  totalBudget: 100,
  status: 'ACTIVE',
  walletId: 'wallet',
  createdAt: new Date(),
  advertiserId: { _id: 'brand', fullName: 'Brand', profilePicture: null },
});

const query = (result) => {
  const instance = {
    sort: jest.fn(() => instance),
    limit: jest.fn(() => instance),
    populate: jest.fn(() => instance),
    select: jest.fn(() => instance),
    lean: jest.fn().mockResolvedValue(result),
  };
  return instance;
};

describe('campaign recommendation signals', () => {
  const originalUrl = process.env.AI_SERVICE_URL;
  const originalKey = process.env.AI_SERVICE_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_SERVICE_URL = '';
    process.env.AI_SERVICE_API_KEY = '';
    CreatorPreferences.findOne.mockReturnValue(query(null));
    Application.find.mockImplementation((filter) => {
      if (filter.status) return query([]);
      if (filter.campaignId?.$in && filter.creatorId?.$ne) return query([{ creatorId: 'peer' }]);
      if (filter.creatorId?.$in) return query([]);
      return query([]);
    });
    Favorite.find.mockImplementation((filter) => {
      if (filter.campaignId?.$in && filter.creatorId?.$ne) return query([{ creatorId: 'peer' }]);
      if (filter.creatorId?.$in) return query([{ campaignId: 'target' }]);
      if (filter.campaignId?.$in) return query([]);
      return query([{ campaignId: 'prior-campaign' }]);
    });
    Campaign.find.mockReturnValue(query([
      campaign('fallback', 'CLIPPING'),
      campaign('target', 'UGC'),
    ]));
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.AI_SERVICE_API_KEY;
    else process.env.AI_SERVICE_API_KEY = originalKey;
  });

  it('adds collaborator activity from creators sharing a saved campaign', async () => {
    const result = await getRecommendations('creator-a', 10);
    const recommended = result.data.find((item) => item.id === 'target');
    expect(recommended.reasons.map((reason) => reason.code)).toContain('SIMILAR_CREATORS_INTERACTED');
    expect(Application.find).toHaveBeenCalledWith(expect.objectContaining({ creatorId: { $in: ['peer'] } }));
  });

  it('adds content similarity from a bounded AI ranking response and keeps live DB fallback available', async () => {
    process.env.AI_SERVICE_URL = 'http://ai-service.test';
    process.env.AI_SERVICE_API_KEY = 'test-only';
    CreatorPreferences.findOne.mockReturnValue(query({ preferredContentTypes: ['UGC'], preferredCountries: ['JOR'], minCpm: 0 }));
    aiIntelligence.rankRecommendations.mockResolvedValue({
      status: 'AVAILABLE', method: 'content_based_and_collaborative',
      data: [{ campaignId: 'fallback', score: 0.1 }, { campaignId: 'target', score: 0.9 }],
    });

    const result = await getRecommendations('creator-a', 10);
    const target = result.data.find((item) => item.id === 'target');
    expect(aiIntelligence.rankRecommendations).toHaveBeenCalledTimes(1);
    expect(target.reasons.map((reason) => reason.code)).toContain('CONTENT_SIMILARITY');
  });
});
