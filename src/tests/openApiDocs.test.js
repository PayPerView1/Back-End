const request = require('supertest');
const { getMountedRoutes } = require('../../scripts/openapiRouteInventory');

process.env.GOOGLE_CLIENT_ID ||= 'openapi-docs-test-client';
process.env.GOOGLE_CLIENT_SECRET ||= 'openapi-docs-test-secret';
process.env.JWT_SECRET ||= 'openapi-docs-test-jwt-secret';

const app = require('../app');

describe('Main Backend API documentation', () => {
  test('serves the generated OpenAPI document and covers mounted routes', async () => {
    const response = await request(app).get('/openapi.json').expect(200).expect('Content-Type', /json/);
    const spec = response.body;
    const operations = [];
    for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if (pathItem[method]) operations.push(`${method} ${apiPath}`);
      }
    }
    const mounted = getMountedRoutes().map((route) => `${route.method} ${route.path}`);

    expect(spec.openapi).toMatch(/^3\.1\./);
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
    expect(operations.sort()).toEqual(mounted.sort());
  });

  test('serves Swagger UI configured for the Main Backend specification', async () => {
    const response = await request(app).get('/docs').expect(200).expect('Content-Type', /html/);
    expect(response.text).toContain('SwaggerUIBundle');
    expect(response.text).toContain("url: '/openapi.json'");
  });

  test('serves ReDoc configured for the Main Backend specification', async () => {
    const response = await request(app).get('/redoc').expect(200).expect('Content-Type', /html/);
    expect(response.text).toContain('<redoc spec-url="/openapi.json"></redoc>');
  });

  test('documents workflow roles, async processing, and only mounted aliases', async () => {
    const { body: spec } = await request(app).get('/openapi.json').expect(200);
    const getSubmissions = spec.paths['/campaigns/{campaignId}/submissions'].get;
    const createSubmission = spec.paths['/campaigns/{campaignId}/submissions'].post;

    expect(getSubmissions['x-roles']).toEqual(['BRAND_OWNER']);
    expect(createSubmission['x-roles']).toEqual(['CLIPPER']);
    expect(spec.paths['/submissions/{id}/views'].get['x-roles']).toEqual(['CLIPPER', 'BRAND_OWNER']);
    expect(createSubmission.description).toContain('asynchronous processing');
    expect(createSubmission.requestBody.content['application/json'].schema.$ref).toContain('CreateSubmissionInput');
    expect(spec.paths['/categories'].get.security).toEqual([]);
    expect(spec.paths['/campaigns/{campaignId}/report'].post.security).toContainEqual({});
    expect(spec.paths['/admin/wallet/refund/{id}']).toBeUndefined();
    expect(spec.paths['/wallet/refunds/list'].get).toBeDefined();
  });

  test('documents Sprint 2 and 3 AI route contracts, owner roles, and typed response bodies', async () => {
    const { body: spec } = await request(app).get('/openapi.json').expect(200);
    const draft = spec.paths['/campaigns/drafts/{draftId}/ai-assistance'].post;
    const insights = spec.paths['/campaigns/{campaignId}/ai-insights'].get;
    const wallet = spec.paths['/wallet/intelligence'].post;
    const walletCompatibility = spec.paths['/ai/wallet/intelligence'].post;

    expect(draft['x-roles']).toEqual(['BRAND']);
    expect(draft.tags).toEqual(['AI Campaign Intelligence']);
    expect(draft.requestBody).toBeUndefined();
    expect(draft.responses['200'].content['application/json'].schema.$ref).toContain('CampaignDraftAIResponse');
    expect(insights['x-roles']).toEqual(['BRAND']);
    expect(insights.responses['200'].content['application/json'].schema.$ref).toContain('CampaignInsightsAIResponse');
    expect(wallet['x-roles']).toEqual(['BRAND']);
    expect(wallet.tags).toEqual(['AI Budget Intelligence']);
    expect(wallet.requestBody.content['application/json'].schema.$ref).toContain('PaymentRiskAssessmentInput');
    expect(spec.components.schemas.PaymentRiskAssessmentInput.properties.transactionId).toBeDefined();
    expect(wallet.responses['200'].content['application/json'].schema.$ref).toContain('WalletIntelligenceAIResponse');
    expect(walletCompatibility['x-roles']).toEqual(['BRAND']);
    expect(walletCompatibility.tags).toEqual(['AI Budget Intelligence']);
    expect(walletCompatibility.requestBody.content['application/json'].schema.$ref).toContain('PaymentRiskAssessmentInput');
    expect(walletCompatibility.responses['200'].content['application/json'].schema.$ref).toContain('WalletIntelligenceAIResponse');
  });

  test('documents campaign view intelligence and keeps estimates distinct from ledger earnings', async () => {
    const { body: spec } = await request(app).get('/openapi.json').expect(200);
    const analytics = spec.paths['/campaigns/{campaignId}/analytics'].get;
    expect(analytics['x-roles']).toEqual(['BRAND_OWNER']);
    expect(analytics.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/CampaignAnalyticsResponse');
    expect(spec.components.schemas.CampaignAnalyticsData.properties.viewIntelligence.$ref).toBe('#/components/schemas/CampaignViewIntelligence');
    expect(spec.components.schemas.CampaignViewIntelligence.properties.earningsPrediction.properties.status.enum)
      .toEqual(['ESTIMATED', 'INSUFFICIENT_DATA']);
    expect(spec.components.schemas.CampaignViewIntelligence.properties.nonTargetGeographicAnomaly.properties.isFraud.const).toBe(false);
  });

  test('documents Sprint 8-10 intelligence, role boundaries, and translated response contracts', async () => {
    const { body: spec } = await request(app).get('/openapi.json').expect(200);
    const withdrawal = spec.paths['/creator/withdrawals/intelligence'].post;
    const reportSummary = spec.paths['/campaigns/{campaignId}/report-summary'].get;
    const language = spec.paths['/language/translate'].post;
    expect(withdrawal['x-roles']).toEqual(['CLIPPER']);
    expect(withdrawal.tags).toEqual(['AI Wallet and Withdrawal Intelligence']);
    expect(withdrawal.responses['200'].content['application/json'].schema.$ref).toContain('CreatorWithdrawalIntelligenceResponse');
    expect(reportSummary['x-roles']).toEqual(['BRAND_OWNER']);
    expect(language['x-roles']).toEqual(['AUTHENTICATED']);
    expect(language.requestBody.content['application/json'].schema.$ref).toContain('TranslationInput');
    expect(spec.components.schemas.CampaignInsightsAIData.required).toContain('successfulCampaignPatterns');
  });

  test('documents optional applicant ranking and report triage contracts and role restrictions', async () => {
    const { body: spec } = await request(app).get('/openapi.json').expect(200);
    const ranking = spec.paths['/campaigns/{campaignId}/applications/ai-ranking'].get;
    const triage = spec.paths['/reports/{id}/ai-triage'].post;

    expect(ranking['x-roles']).toEqual(['BRAND_OWNER']);
    expect(ranking.tags).toEqual(['AI Recommendations']);
    expect(ranking.requestBody).toBeUndefined();
    expect(ranking.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/CampaignApplicantRankingResponse');
    expect(spec.components.schemas.CampaignApplicantRankingResponse.properties.data.properties.meta.properties.unavailableDemographics).toBeDefined();
    expect(triage['x-roles']).toEqual(['ADMIN']);
    expect(triage.tags).toEqual(['AI Report Intelligence']);
    expect(triage.requestBody).toBeUndefined();
    expect(triage.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/ReportAITriageResponse');
    expect(triage.description).toContain('does not prove a violation');

    const earnings = spec.paths['/creator/earnings/prediction'].get;
    expect(earnings['x-roles']).toEqual(['CLIPPER']);
    expect(earnings.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/CreatorEarningsPredictionResponse');
    expect(earnings.description).toContain('seven-day hold');
    expect(spec.components.schemas.CreatorEarningsPredictionResponse.properties.data.properties.estimatedCreatorNetAmountCents.type)
      .toEqual(['integer', 'null']);
  });
});
