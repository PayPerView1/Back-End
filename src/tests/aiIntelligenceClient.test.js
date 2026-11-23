jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');
const client = require('../services/ai/aiIntelligence.client');

describe('AI engineering client', () => {
  const originalBaseUrl = process.env.AI_SERVICE_BASE_URL;
  const originalUrl = process.env.AI_SERVICE_URL;
  const originalKey = process.env.AI_SERVICE_API_KEY;
  const originalTimeout = process.env.AI_INTELLIGENCE_TIMEOUT_MS;
  const originalEnabled = process.env.AI_SERVICE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_SERVICE_BASE_URL = 'https://ai.example.invalid/';
    delete process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_API_KEY = 'test-only-key';
    process.env.AI_INTELLIGENCE_TIMEOUT_MS = '45000';
    delete process.env.AI_SERVICE_ENABLED;
  });

  afterAll(() => {
    if (originalBaseUrl === undefined) delete process.env.AI_SERVICE_BASE_URL;
    else process.env.AI_SERVICE_BASE_URL = originalBaseUrl;
    if (originalUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.AI_SERVICE_API_KEY;
    else process.env.AI_SERVICE_API_KEY = originalKey;
    if (originalTimeout === undefined) delete process.env.AI_INTELLIGENCE_TIMEOUT_MS;
    else process.env.AI_INTELLIGENCE_TIMEOUT_MS = originalTimeout;
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
  });

  it('sends the service credential in a header and bounds recommendation latency', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { status: 'AVAILABLE', method: 'content_based_and_collaborative', data: [] } });
    await client.rankRecommendations({ creatorProfile: {}, campaigns: [], collaborativeSignals: {} });

    expect(axios.post).toHaveBeenCalledWith(
      'https://ai.example.invalid/api/v1/ai/intelligence/recommendations/rank',
      expect.any(Object),
      expect.objectContaining({
        timeout: 1500,
        headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'test-only-key' },
      })
    );
  });

  it('rejects malformed AI recommendation scores so callers fall back safely', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { status: 'AVAILABLE', method: 'content_based_and_collaborative', data: [{ campaignId: 'c1', score: 4, reasons: [] }] } });
    await expect(client.rankRecommendations({ creatorProfile: {}, campaigns: [], collaborativeSignals: {} }))
      .rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('validates nested draft analysis and expiry fields before returning them', async () => {
    axios.post.mockResolvedValue({ status: 200, data: {
      policyDecision: 'APPROVED', qualityScore: 90, category: 'UGC', subCategories: [],
      feedback: 'The saved brief is clear.', checks: [], suggestions: [],
      duplicateDrafts: { status: 'AVAILABLE', matches: [] },
      expiryPrediction: { status: 'NOT_EXPIRING_SOON', notify: false, daysUntilExpiry: 20, basis: 'SAVED_DRAFT_EXPIRY' },
    } });
    await expect(client.analyzeDraft({ draft: {} })).resolves.toMatchObject({ policyDecision: 'APPROVED' });

    axios.post.mockResolvedValue({ status: 200, data: {
      policyDecision: 'APPROVED', qualityScore: 90, category: 'UGC', subCategories: [],
      feedback: 'The saved brief is clear.', checks: [], suggestions: [],
      duplicateDrafts: { status: 'AVAILABLE', matches: [] },
      expiryPrediction: { status: 'NOT_EXPIRING_SOON', daysUntilExpiry: 20, basis: 'SAVED_DRAFT_EXPIRY' },
    } });
    await expect(client.analyzeDraft({ draft: {} })).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('rejects malformed nested campaign and budget analysis responses', async () => {
    axios.post.mockResolvedValue({ status: 200, data: {
      performancePrediction: {}, similarCampaigns: {}, categoryAnalytics: {}, archivedCampaignAnalysis: {},
      successfulCampaignPatterns: {}, policyAcceptanceAnalytics: {},
    } });
    await expect(client.analyzeCampaign({ campaign: {} })).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });

    axios.post.mockResolvedValue({ status: 200, data: {
      paymentFraud: {}, paymentMethodRecommendation: {}, depositAmountPrediction: {}, dailyBudgetRecommendation: {},
      budgetExhaustionPrediction: {}, spendingAnomaly: {}, refundFraud: {}, refundMethodRecommendation: {}, refundLikelihoodPrediction: {},
    } });
    await expect(client.analyzeBudget({})).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('does not expose provider response bodies in integration errors', async () => {
    axios.post.mockRejectedValue({ response: { status: 503, data: { secret: 'provider detail' } } });
    await expect(client.analyzeBudget({})).rejects.toThrow('AI service request failed');
    await expect(client.analyzeBudget({})).rejects.not.toThrow('provider detail');
  });

  it('returns a controlled unavailable error for an upstream timeout', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('request timeout'), { code: 'ECONNABORTED' }));
    await expect(client.analyzeBudget({})).rejects.toMatchObject({
      code: 'AI_SERVICE_UNAVAILABLE',
      status: null,
    });
    await expect(client.analyzeBudget({})).rejects.not.toThrow('request timeout');
  });

  it('returns an unavailable error without connecting when the integration is disabled', async () => {
    process.env.AI_SERVICE_ENABLED = 'false';

    await expect(client.analyzeBudget({})).rejects.toMatchObject({ code: 'AI_SERVICE_UNAVAILABLE' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('sends bounded seven-day view analysis with the internal service credential', async () => {
    axios.post.mockResolvedValue({ status: 200, data: {
      campaignId: 'campaign-1', windowDays: 7, observedViews: 200, validatedViewsInWindow: 0,
      pendingValidationViewsInWindow: 100, flaggedViewsPendingReview: 0, maturedValidatedViews: 10, confirmedGrossEarningsCents: 50, confirmedCreatorNetEarningsCents: 45,
      suspiciousPatterns: [], futureViewPrediction: { status: 'ESTIMATED', predictedNext7DaysViews: 500 },
      geographicAudience: { status: 'AVAILABLE', countries: [] },
      nonTargetGeographicAnomaly: { isFraud: false },
      earningsPrediction: { status: 'INSUFFICIENT_DATA', estimatedGrossAmountCents: null, estimatedCreatorNetAmountCents: null },
    } });
    const payload = { campaignId: 'campaign-1', cpm: 5, targetCountries: ['JOR'], events: [], validatedHistory: [] };
    await client.analyzeViews(payload);

    expect(axios.post).toHaveBeenCalledWith(
      'https://ai.example.invalid/api/v1/ai/intelligence/views/analyze',
      payload,
      expect.objectContaining({
        timeout: 8000,
        headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'test-only-key' },
      })
    );
  });

  it('rejects a view analysis that does not match its requested campaign or seven-day window', async () => {
    axios.post.mockResolvedValue({ status: 200, data: {
      campaignId: 'other-campaign', windowDays: 30, observedViews: 20, validatedViewsInWindow: 10,
      suspiciousPatterns: [], futureViewPrediction: { status: 'ESTIMATED' },
      geographicAudience: {}, earningsPrediction: { status: 'INSUFFICIENT_DATA' },
    } });
    await expect(client.analyzeViews({ campaignId: 'campaign-1' })).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('sends creator withdrawal history to the internal AI service and validates the advisory response', async () => {
    const payload = { country: 'JO', candidate: { amountCents: 5000, method: 'PAYPAL' }, availableMethods: ['PAYPAL'], paymentMethodsByCountry: { JO: ['PAYPAL'] }, withdrawals: [] };
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'ASSESSED', risk: 'LOW', confidence: 'LOW', requiresHumanReview: false, signals: [],
      historySampleSize: 0, requestsLast24Hours: 0,
      processingTimePrediction: { status: 'INSUFFICIENT_DATA', medianHours: null, sampleSize: 0 },
      paymentMethodRecommendation: { status: 'RECOMMENDED', country: 'JO', methods: ['PAYPAL'], basis: 'Configured.' },
    } });
    await client.analyzeWithdrawals(payload);
    expect(axios.post).toHaveBeenCalledWith(
      'https://ai.example.invalid/api/v1/ai/intelligence/withdrawals/analyze',
      payload,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'test-only-key' } })
    );
  });

  it('rejects withdrawal recommendations that do not match active method types', async () => {
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'ASSESSED', risk: 'LOW', confidence: 'LOW', requiresHumanReview: false, signals: [],
      historySampleSize: 0, requestsLast24Hours: 0,
      processingTimePrediction: { status: 'INSUFFICIENT_DATA', medianHours: null, sampleSize: 0 },
      paymentMethodRecommendation: { status: 'RECOMMENDED', country: 'JO', methods: ['WIRE_COIN'], basis: 'invalid' },
    } });
    await expect(client.analyzeWithdrawals({})).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('sends applicant ranking through the internal service credential and validates ordered score components', async () => {
    const payload = { campaign: { id: 'campaign-1' }, applicants: [{ id: 'app-1' }] };
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'AVAILABLE', method: 'GEMINI_EMBEDDINGS', data: [{
        applicantId: 'app-1', rank: 1, compatibilityScore: 0.8, confidence: 0.7,
        reasonCodes: ['CATEGORY_MATCH'], dataStatus: 'AVAILABLE',
        breakdown: { contentCompatibility: null, audienceCountryMatch: 0.5, categoryMatch: 1, historicalPerformance: 0.7 },
      }],
    } });
    await client.rankApplicants(payload);
    expect(axios.post).toHaveBeenCalledWith(
      'https://ai.example.invalid/api/v1/ai/intelligence/campaign/applicants/rank',
      payload,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'test-only-key' } })
    );
  });

  it('rejects malformed or duplicate applicant ranking results', async () => {
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'AVAILABLE', method: 'TOKEN_OVERLAP_FALLBACK', data: [
        { applicantId: 'app-1', rank: 1, compatibilityScore: 0.8, confidence: 0.7, reasonCodes: [], dataStatus: 'AVAILABLE', breakdown: { contentCompatibility: 0.5, audienceCountryMatch: null, categoryMatch: null, historicalPerformance: null } },
        { applicantId: 'app-1', rank: 2, compatibilityScore: 0.6, confidence: 0.5, reasonCodes: [], dataStatus: 'AVAILABLE', breakdown: { contentCompatibility: 0.5, audienceCountryMatch: null, categoryMatch: null, historicalPerformance: null } },
      ],
    } });
    await expect(client.rankApplicants({ applicants: [{ id: 'app-1' }, { id: 'app-2' }] }))
      .rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('validates report triage taxonomy, duplicate evidence, and mandatory human review', async () => {
    const payload = { targetType: 'CAMPAIGN', reason: 'FALSE_CLAIMS', details: 'A claim needs review.' };
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'NEEDS_REVIEW', category: 'FALSE_CLAIMS', severity: 'UNKNOWN', confidence: 0.4,
      explanation: 'The supplied report needs a reviewer.', needsHumanReview: true,
      suggestedActions: ['REVIEW_EVIDENCE'], duplicateStatus: 'INSUFFICIENT_DATA', duplicateMethod: 'NONE',
      duplicateDetected: false, similarReports: [],
    } });
    await client.classifyReport(payload);
    expect(axios.post).toHaveBeenCalledWith(
      'https://ai.example.invalid/api/v1/ai/intelligence/reports/classify',
      payload,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'test-only-key' } })
    );

    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'CLASSIFIED', category: 'FALSE_CLAIMS', severity: 'HIGH', confidence: 0.9,
      explanation: 'Evidence should be checked.', needsHumanReview: false,
      suggestedActions: [], duplicateStatus: 'ASSESSED', duplicateMethod: 'TOKEN_OVERLAP',
      duplicateDetected: false, similarReports: [],
    } });
    await expect(client.classifyReport(payload)).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });

  it('requests a creator-scoped earnings estimate and keeps all forecast values separate from the wallet ledger', async () => {
    const payload = { asOfDate: '2026-11-10', campaigns: [{ campaignId: 'campaign-1', applicableCpm: 5, dailyHistory: [] }] };
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'ESTIMATED', windowDays: 7, currency: 'USD', method: 'MATURED_VIEW_TREND_AND_REALIZED_CPM',
      estimatedGrossAmountCents: 250, estimatedCreatorNetAmountCents: 225, predictedNext7DaysViews: 500,
      confidence: 0.51, campaignsAnalyzed: 1, campaignsEstimated: 1,
      explanation: 'Estimate only; separate from the confirmed wallet balance.',
      campaigns: [{ campaignId: 'campaign-1', status: 'ESTIMATED', historicalDays: 4, maturedValidatedViews: 3900,
        predictedNext7DaysViews: 500, estimatedGrossAmountCents: 250, estimatedCreatorNetAmountCents: 225,
        confidence: 0.51, explanation: 'Estimate only.' }],
    } });
    await client.predictCreatorEarnings(payload);
    expect(axios.post).toHaveBeenCalledWith(
      'https://ai.example.invalid/api/v1/ai/intelligence/creator-earnings/predict',
      payload,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'test-only-key' } })
    );
  });

  it('rejects creator forecast amounts that exceed confirmed gross or omit estimated totals', async () => {
    const payload = { asOfDate: '2026-11-10', campaigns: [{ campaignId: 'campaign-1' }] };
    axios.post.mockResolvedValue({ status: 200, data: {
      status: 'ESTIMATED', windowDays: 7, currency: 'USD', method: 'MATURED_VIEW_TREND_AND_REALIZED_CPM',
      estimatedGrossAmountCents: 200, estimatedCreatorNetAmountCents: 250, predictedNext7DaysViews: 500,
      confidence: 0.5, campaignsAnalyzed: 1, campaignsEstimated: 1,
      explanation: 'Estimate.', campaigns: [{ campaignId: 'campaign-1', status: 'ESTIMATED', historicalDays: 4, maturedValidatedViews: 3900,
        predictedNext7DaysViews: 500, estimatedGrossAmountCents: 200, estimatedCreatorNetAmountCents: 250, confidence: 0.5, explanation: 'Estimate.' }],
    } });
    await expect(client.predictCreatorEarnings(payload)).rejects.toMatchObject({ code: 'AI_SERVICE_BAD_RESPONSE' });
  });
});
