// src/tests/campaignRecommendation.test.js
// المالك: الشخص B — اختبارات التوصيات.
// المرجع: API_CONTRACT_Sprint4.md §2.1

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const Application = require('../models/application');
const CreatorPreferences = require('../models/creatorPreferences');
const generateToken = require('../utils/generateTokens');

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

let mongoServer;
let clipperUser, clipperToken;
let brandUser, brandToken;
let campaignSau, campaignEgy, campaignUgc;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Campaign.deleteMany({});
  await Application.deleteMany({});
  await CreatorPreferences.deleteMany({});
  jest.clearAllMocks();

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
    // ما في تفضيلات → كل matchScore = 0
    res.body.data.forEach((c) => {
      expect(c.matchScore).toBe(0);
    });
  });
});