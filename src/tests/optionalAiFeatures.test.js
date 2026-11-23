jest.mock('../models/campaign', () => ({ findOne: jest.fn() }));
jest.mock('../models/application', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/creatorPreferences', () => ({ find: jest.fn() }));
jest.mock('../models/CreatorEarning', () => ({ find: jest.fn() }));
jest.mock('../models/SubmissionViewSnapshot', () => ({ aggregate: jest.fn() }));
jest.mock('../models/report', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../services/ai/aiIntelligence.client', () => ({ rankApplicants: jest.fn(), classifyReport: jest.fn() }));

const mongoose = require('mongoose');
const Campaign = require('../models/campaign');
const Application = require('../models/application');
const CreatorPreferences = require('../models/creatorPreferences');
const CreatorEarning = require('../models/CreatorEarning');
const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
const Report = require('../models/report');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const { getCampaignApplicantRanking } = require('../services/application/applicantRanking.service');
const { triageReport, redactPrivateText } = require('../services/moderation/reportAI.service');

const query = (result, chainNames = []) => {
  const builder = {};
  for (const name of chainNames) builder[name] = jest.fn(() => builder);
  builder.lean = jest.fn().mockResolvedValue(result);
  return builder;
};

describe('optional AI backend integrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ranks only pending applicants for a campaign owned by the requesting brand and sends matured real signals', async () => {
    const campaignId = new mongoose.Types.ObjectId();
    const brandId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const applicationId = new mongoose.Types.ObjectId();
    const campaign = {
      _id: campaignId,
      name: 'Product story',
      contentType: 'UGC',
      category: 'LIFESTYLE',
      subCategories: ['FOOD'],
      targetCountries: ['JOR'],
      brief: { mainIdea: 'Show the reusable bottle in a day routine.', tone: 'Friendly', keywords: ['reusable'] },
    };
    const application = {
      _id: applicationId,
      status: 'PENDING',
      message: 'I have applied.',
      appliedAt: new Date('2026-11-01T10:00:00Z'),
      creatorId: { _id: creatorId, fullName: 'Creator Example', profilePicture: null, interests: ['LIFESTYLE'] },
    };
    Campaign.findOne.mockReturnValue(query(campaign, ['select']));
    Application.find.mockReturnValue(query([application], ['populate', 'sort', 'limit']));
    Application.countDocuments.mockResolvedValue(1);
    CreatorPreferences.find.mockReturnValue(query([{ creatorId, preferredContentTypes: ['UGC'], preferredCountries: ['JOR'] }], ['select']));
    CreatorEarning.find.mockReturnValue(query([{
      creatorId, views: 1200, campaignId: { contentType: 'UGC', category: 'FOOD' },
    }], ['sort', 'limit', 'select', 'populate']));
    SubmissionViewSnapshot.aggregate.mockResolvedValue([]);
    aiIntelligence.rankApplicants.mockResolvedValue({
      status: 'AVAILABLE', method: 'GEMINI_EMBEDDINGS', data: [{
        applicantId: String(applicationId), rank: 1, compatibilityScore: 0.85, confidence: 0.7,
        reasonCodes: ['CATEGORY_MATCH'], dataStatus: 'AVAILABLE',
        breakdown: { contentCompatibility: 0.8, audienceCountryMatch: 1, categoryMatch: 1, historicalPerformance: 1 },
      }],
    });

    const result = await getCampaignApplicantRanking(String(campaignId), String(brandId), new Date('2026-11-10T00:00:00Z'));

    expect(Campaign.findOne).toHaveBeenCalledWith({ _id: String(campaignId), advertiserId: String(brandId) });
    expect(Application.find).toHaveBeenCalledWith({ campaignId, status: 'PENDING' });
    const payload = aiIntelligence.rankApplicants.mock.calls[0][0];
    expect(payload.campaign.content).toContain('Show the reusable bottle');
    expect(payload.campaign.targetCountries).toEqual(['JOR']);
    expect(payload.applicants[0].categories).toEqual(expect.arrayContaining(['UGC', 'LIFESTYLE', 'FOOD']));
    expect(payload.applicants[0].historicalPerformance).toEqual({ sampleSize: 1, validatedViews: 1200 });
    expect(payload.applicants[0]).not.toHaveProperty('fullName');
    expect(result.data[0].creator.fullName).toBe('Creator Example');
    expect(result.meta.audienceDemographicsAvailable).toEqual(['COUNTRY']);
    expect(result.meta.unavailableDemographics).toEqual(['AGE', 'GENDER']);
  });

  test('returns not found when the brand does not own the campaign', async () => {
    Campaign.findOne.mockReturnValue(query(null, ['select']));
    await expect(getCampaignApplicantRanking(new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(Application.find).not.toHaveBeenCalled();
    expect(aiIntelligence.rankApplicants).not.toHaveBeenCalled();
  });

  test('report triage compares confirmed reports on the same target and redacts private text', async () => {
    const reportId = new mongoose.Types.ObjectId();
    const campaignId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();
    Report.findOne.mockReturnValue(query({
      _id: reportId, campaignId, clipId: null, reason: 'FALSE_CLAIMS',
      details: 'Please review this promise. Contact me at creator@example.com',
    }, ['select']));
    Report.find.mockReturnValue(query([{
      _id: candidateId, reason: 'FALSE_CLAIMS', details: 'A prior allegation against https://example.invalid/report',
    }], ['sort', 'limit', 'select']));
    aiIntelligence.classifyReport.mockResolvedValue({ status: 'NEEDS_REVIEW', needsHumanReview: true });

    await triageReport(String(reportId));

    expect(Report.findOne).toHaveBeenCalledWith({ _id: String(reportId), isConfirmed: true });
    expect(Report.find).toHaveBeenCalledWith(expect.objectContaining({
      campaignId, _id: { $ne: reportId }, isConfirmed: true, status: { $ne: 'DISMISSED' },
    }));
    const payload = aiIntelligence.classifyReport.mock.calls[0][0];
    expect(payload.targetType).toBe('CAMPAIGN');
    expect(payload.details).not.toContain('creator@example.com');
    expect(payload.candidateReports[0].details).not.toContain('example.invalid');
    expect(payload.candidateReports[0].id).toBe(String(candidateId));
  });

  test('redacts common private contact patterns without modifying non-contact report text', () => {
    const text = redactPrivateText('Claim details: me@example.com +962 79 123 4567 https://example.invalid/x');
    expect(text).toContain('[redacted email]');
    expect(text).toContain('[redacted phone]');
    expect(text).toContain('[redacted link]');
    expect(text).toContain('Claim details');
  });
});
