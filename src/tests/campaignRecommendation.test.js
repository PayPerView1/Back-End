// src/tests/campaignRecommendation.test.js
// المالك: الشخص B — اختبارات التوصيات.
// المرجع: API_CONTRACT_Sprint4.md §2.1

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');

const db = require('./helpers/db');
const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const Application = require('../models/application');
const CreatorPreferences = require('../models/creatorPreferences');
const Favorite = require('../models/favorite');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const generateToken = require('../utils/generateTokens');

jest.setTimeout(40000);

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendFundingSuccessEmail: jest.fn().mockResolvedValue(true),
  sendFundingFailedEmail: jest.fn().mockResolvedValue(true),
  sendBankTransferReceivedEmail: jest.fn().mockResolvedValue(true),
  sendBankTransferApprovedEmail: jest.fn().mockResolvedValue(true),
  sendBankTransferRejectedEmail: jest.fn().mockResolvedValue(true),
  sendBudgetExhaustedEmail: jest.fn().mockResolvedValue(true),
  sendRefundSubmittedEmail: jest.fn().mockResolvedValue(true),
  sendRefundApprovedEmail: jest.fn().mockResolvedValue(true),
  sendRefundRejectedEmail: jest.fn().mockResolvedValue(true),
  sendRefundCancelledEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/wallet/paypal.service');

let clipperUser, clipperToken;
let brandUser, brandToken;
let campaignSau, campaignEgy, campaignUgc;
const originalAiServiceUrl = process.env.AI_SERVICE_URL;
const originalAiServiceKey = process.env.AI_SERVICE_API_KEY;

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await db.disconnect();
  if (originalAiServiceUrl === undefined) delete process.env.AI_SERVICE_URL;
  else process.env.AI_SERVICE_URL = originalAiServiceUrl;
  if (originalAiServiceKey === undefined) delete process.env.AI_SERVICE_API_KEY;
  else process.env.AI_SERVICE_API_KEY = originalAiServiceKey;
});

beforeEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
  process.env.AI_SERVICE_URL = '';
  process.env.AI_SERVICE_API_KEY = '';

  clipperUser = await User.create({
    fullName: 'Test Clipper',
    email: 'clipper@test.com',
    password: 'password123',
    role: 'CLIPPER',
  });
  clipperToken = generateToken(clipperUser._id, clipperUser.role);

  brandUser = await User.create({
    fullName: 'Test Brand',
    email: 'brand@test.com',
    password: 'password123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);

  campaignSau = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Saudi Clipping Campaign',
    contentType: 'CLIPPING',
    category: 'CLIPPING',
    totalBudget: 1000,
    remainingBudget: 500,
    cpm: 2.0,
    brief: { mainIdea: 'Test' },
    targetCountries: ['SAU'],
    status: 'ACTIVE',
    walletId: new mongoose.Types.ObjectId(),
  });

  campaignEgy = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Egypt UGC Campaign',
    contentType: 'UGC',
    category: 'UGC',
    totalBudget: 1000,
    remainingBudget: 500,
    cpm: 1.5,
    brief: { mainIdea: 'Test' },
    targetCountries: ['EGY'],
    status: 'ACTIVE',
    walletId: new mongoose.Types.ObjectId(),
  });

  campaignUgc = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Low CPM UGC',
    contentType: 'UGC',
    category: 'UGC',
    totalBudget: 1000,
    remainingBudget: 500,
    cpm: 0.5,
    brief: { mainIdea: 'Test' },
    targetCountries: ['ARE'],
    status: 'ACTIVE',
    walletId: new mongoose.Types.ObjectId(),
  });
});

// ============================================
// GET /campaigns/recommendations
// ============================================
describe('GET /api/v1/campaigns/recommendations', () => {
  it('✅ يرجع قائمة فاضية بدون تفضيلات (hasPreferences: false)', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=10')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.hasPreferences).toBe(false);
  });

  it('✅ hasPreferences: true عند وجود مستند تفضيلات', async () => {
    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['CLIPPING'],
      preferredCountries: ['SAU'],
      minCpm: 1.0,
    });

    const res = await request(app)
      .get('/api/v1/campaigns/recommendations')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.meta.hasPreferences).toBe(true);
  });

  it('✅ يرتب حسب matchScore (الأعلى أولاً)', async () => {
    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['CLIPPING'],
      preferredCountries: ['SAU'],
      minCpm: 1.0,
    });

    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=10')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    // الحملة الأولى يجب أن تكون Saudi Clipping (score أعلى)
    const first = res.body.data[0];
    expect(first.matchScore).toBeGreaterThan(0);
    expect(Array.isArray(first.reasons)).toBe(true);

    // التأكد من الترتيب التنازلي
    for (let i = 1; i < res.body.data.length; i++) {
      expect(res.body.data[i - 1].matchScore).toBeGreaterThanOrEqual(
        res.body.data[i].matchScore
      );
    }
  });

  it('✅ يرجّع reasons (COUNTRY_MATCH, CONTENT_TYPE_MATCH)', async () => {
    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['CLIPPING'],
      preferredCountries: ['SAU'],
      minCpm: 1.0,
    });

    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=10')
      .set('Authorization', `Bearer ${clipperToken}`);

    const saudiClipping = res.body.data.find(
      (c) => c.id === campaignSau._id.toString()
    );

    expect(saudiClipping).toBeDefined();
    expect(saudiClipping.reasons.length).toBeGreaterThan(0);

    const codes = saudiClipping.reasons.map((r) => r.code);
    expect(codes).toContain('COUNTRY_MATCH');
    expect(codes).toContain('CONTENT_TYPE_MATCH');
  });

  it('uses shared application and favorite activity as collaborative evidence', async () => {
    const peer = await User.create({ fullName: 'Peer Creator', email: 'peer@test.com', password: 'password123', role: 'CLIPPER' });
    await Favorite.create({ creatorId: clipperUser._id, campaignId: campaignSau._id });
    await Favorite.create({ creatorId: peer._id, campaignId: campaignSau._id });
    await Favorite.create({ creatorId: peer._id, campaignId: campaignUgc._id });

    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=10')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    const ugc = res.body.data.find((campaign) => campaign.id === campaignUgc._id.toString());
    expect(ugc.reasons.map((reason) => reason.code)).toContain('SIMILAR_CREATORS_INTERACTED');
  });

  it('uses AI embedding ranks when configured and keeps the database scorer as fallback', async () => {
    await CreatorPreferences.create({ creatorId: clipperUser._id, preferredContentTypes: ['UGC'] });
    const previousUrl = process.env.AI_SERVICE_URL;
    const previousKey = process.env.AI_SERVICE_API_KEY;
    process.env.AI_SERVICE_URL = 'http://ai-service.test';
    process.env.AI_SERVICE_API_KEY = 'unit-test-key';
    const rank = jest.spyOn(aiIntelligence, 'rankRecommendations').mockResolvedValue({
      status: 'AVAILABLE', method: 'content_based_and_collaborative', data: [
        { campaignId: campaignEgy._id.toString(), score: 0.9, reasons: ['CONTENT_SIMILARITY'] },
      ],
    });
    try {
      const res = await request(app)
        .get('/api/v1/campaigns/recommendations?limit=10')
        .set('Authorization', `Bearer ${clipperToken}`);

      expect(res.statusCode).toBe(200);
      const egypt = res.body.data.find((campaign) => campaign.id === campaignEgy._id.toString());
      expect(egypt.reasons.map((reason) => reason.code)).toContain('CONTENT_SIMILARITY');
      expect(rank).toHaveBeenCalledTimes(1);
    } finally {
      rank.mockRestore();
      if (previousUrl === undefined) delete process.env.AI_SERVICE_URL;
      else process.env.AI_SERVICE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.AI_SERVICE_API_KEY;
      else process.env.AI_SERVICE_API_KEY = previousKey;
    }
  });

  it('✅ يستثني الحملات التي قدّم عليها المبدع', async () => {
    // تقديم على campaignSau
    await Application.create({
      campaignId: campaignSau._id,
      creatorId: clipperUser._id,
      status: 'PENDING',
      appliedAt: new Date(),
    });

    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['CLIPPING'],
      preferredCountries: ['SAU'],
      minCpm: 1.0,
    });

    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=10')
      .set('Authorization', `Bearer ${clipperToken}`);

    const ids = res.body.data.map((c) => c.id);
    expect(ids).not.toContain(campaignSau._id.toString());
  });

  it('✅ limit يحدد عدد النتائج', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=1')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('❌ limit أكبر من 20: 400', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/recommendations?limit=50')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(400);
  });

  it('❌ BRAND: 403', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/recommendations')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون token: 401', async () => {
    const res = await request(app).get('/api/v1/campaigns/recommendations');
    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// GET /campaigns/discover?sort=bestMatch
// ============================================
describe('GET /api/v1/campaigns/discover?sort=bestMatch', () => {
  it('✅ bestMatch يرتب حسب matchScore', async () => {
    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['CLIPPING'],
      preferredCountries: ['SAU'],
      minCpm: 1.0,
    });

    const res = await request(app)
      .get('/api/v1/campaigns/discover?sort=bestMatch')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    // كل حملة يجب أن يكون لها matchScore
    res.body.data.forEach((c) => {
      expect(typeof c.matchScore).toBe('number');
      expect(Array.isArray(c.reasons)).toBe(true);
    });

    // الترتيب تنازلي
    for (let i = 1; i < res.body.data.length; i++) {
      expect(res.body.data[i - 1].matchScore).toBeGreaterThanOrEqual(
        res.body.data[i].matchScore
      );
    }
  });

  it('✅ bestMatch بدون تفضيلات = newest', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover?sort=bestMatch')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);

    // ✅ منع النجاح الزائف على مصفوفة فارغة
    expect(res.body.data.length).toBeGreaterThan(0);
    
    res.body.data.forEach((c) => {
      expect(c.matchScore).toBe(0);
    });
  });
});
