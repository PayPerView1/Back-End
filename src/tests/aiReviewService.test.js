jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');
const aiReviewService = require('../services/campaign/aiReview.service');

describe('campaign AI review service integration contract', () => {
  const originalBaseUrl = process.env.AI_SERVICE_BASE_URL;
  const originalUrl = process.env.AI_SERVICE_URL;
  const originalKey = process.env.AI_SERVICE_API_KEY;
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalTimeout = process.env.AI_SERVICE_TIMEOUT_MS;
  const originalCampaignTimeout = process.env.AI_CAMPAIGN_REVIEW_TIMEOUT_MS;

  beforeEach(() => {
    delete process.env.AI_SERVICE_ENABLED;
    delete process.env.AI_SERVICE_TIMEOUT_MS;
    delete process.env.AI_CAMPAIGN_REVIEW_TIMEOUT_MS;
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalBaseUrl === undefined) delete process.env.AI_SERVICE_BASE_URL;
    else process.env.AI_SERVICE_BASE_URL = originalBaseUrl;
    if (originalUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.AI_SERVICE_API_KEY;
    else process.env.AI_SERVICE_API_KEY = originalKey;
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    if (originalTimeout === undefined) delete process.env.AI_SERVICE_TIMEOUT_MS;
    else process.env.AI_SERVICE_TIMEOUT_MS = originalTimeout;
    if (originalCampaignTimeout === undefined) delete process.env.AI_CAMPAIGN_REVIEW_TIMEOUT_MS;
    else process.env.AI_CAMPAIGN_REVIEW_TIMEOUT_MS = originalCampaignTimeout;
  });

  test('sends the authenticated review contract and validates Gemini output', async () => {
    process.env.AI_SERVICE_BASE_URL = 'http://ai.local';
    delete process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_API_KEY = 'unit-test-service-key';
    axios.post.mockResolvedValue({ status: 200, data: { result: 'APPROVED', score: 91, feedback: 'The brief is clear.' } });
    const campaign = {
      name: 'Test campaign',
      brief: { mainIdea: 'Describe a service' },
      targetCountries: ['USA'],
      halalDeclaration: {
        noGambling: true,
        noSexualContent: true,
        noExplicitMusic: true,
        noAlcohol: true,
        noSuspiciousCurrencies: true,
        noUnrealisticProfit: true,
        declaredBy: 'private-user-id',
        ipAddress: 'private-ip',
      },
    };

    await expect(aiReviewService.reviewCampaign(campaign)).resolves.toEqual({
      result: 'APPROVED', score: 91, feedback: 'The brief is clear.',
    });
    const [url, body, request] = axios.post.mock.calls[0];
    expect(url).toBe('http://ai.local/review');
    expect(request.headers['X-Service-Key']).toBe('unit-test-service-key');
    expect(body.halalDeclaration).not.toHaveProperty('ipAddress');
    expect(body.halalDeclaration).not.toHaveProperty('declaredBy');
  });

  test('fails closed if the shared service key is missing', async () => {
    process.env.AI_SERVICE_BASE_URL = 'http://ai.local';
    delete process.env.AI_SERVICE_API_KEY;
    await expect(aiReviewService.reviewCampaign({})).rejects.toMatchObject({ code: 'AI_SERVICE_UNAVAILABLE' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('rejects malformed provider output instead of applying an approval', async () => {
    process.env.AI_SERVICE_BASE_URL = 'http://ai.local';
    process.env.AI_SERVICE_API_KEY = 'unit-test-service-key';
    axios.post.mockResolvedValue({ status: 200, data: { result: 'APPROVE', score: 150, feedback: '' } });
    await expect(aiReviewService.reviewCampaign({})).rejects.toThrow('invalid campaign review response');
  });

  test('uses the configured campaign-review timeout', async () => {
    process.env.AI_SERVICE_BASE_URL = 'http://ai.local';
    process.env.AI_SERVICE_API_KEY = 'unit-test-service-key';
    process.env.AI_CAMPAIGN_REVIEW_TIMEOUT_MS = '25000';
    axios.post.mockResolvedValue({ status: 200, data: { result: 'APPROVED', score: 91, feedback: 'The brief is clear.' } });

    await aiReviewService.reviewCampaign({});
    expect(axios.post.mock.calls[0][2].timeout).toBe(25000);
    delete process.env.AI_CAMPAIGN_REVIEW_TIMEOUT_MS;
  });
});
