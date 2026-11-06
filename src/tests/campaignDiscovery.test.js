// src/tests/campaignDiscovery.test.js
// المالك: الشخص B — اختبارات اكتشاف الحملات.
// المرجع: API_CONTRACT_Sprint4.md §1

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const db = require('./helpers/db');
const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const Favorite = require('../models/favorite');
const generateToken = require('../utils/generateTokens');

// ⚠️ مهلة أطول: أول تشغيل / اتصال قد يكون بطيئاً
jest.setTimeout(40000);

// ⚠️ الـ emailService و paypal معملهم mock
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
let activeCampaign, pausedCampaign, suspendedCampaign;

beforeAll(async () => {
  await db.connect();          // ✅ استدعاء فعلي
});

afterAll(async () => {
  await db.disconnect();       // ✅ استدعاء فعلي
});

beforeEach(async () => {
  await User.deleteMany({});
  await Campaign.deleteMany({});
  await Favorite.deleteMany({});
  jest.clearAllMocks();

  // Clipper
  clipperUser = await User.create({
    fullName: 'Test Clipper',
    email: 'clipper@test.com',
    password: 'password123',
    role: 'CLIPPER',
  });
  clipperToken = generateToken(clipperUser._id, clipperUser.role);

  // Brand
  brandUser = await User.create({
    fullName: 'Noor Store',
    email: 'brand@test.com',
    password: 'password123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);

  // Campaigns
  activeCampaign = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Active Campaign',
    contentType: 'CLIPPING',
    category: 'CLIPPING',
    totalBudget: 1000,
    remainingBudget: 500,
    cpm: 1.5,
    brief: { mainIdea: 'Test brief' },
    targetCountries: ['SAU', 'ARE'],
    status: 'ACTIVE',
    walletId: new mongoose.Types.ObjectId(),
  });

  pausedCampaign = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Paused Budget Exhausted',
    contentType: 'UGC',
    category: 'UGC',
    totalBudget: 1000,
    remainingBudget: 0,
    cpm: 2.0,
    brief: { mainIdea: 'Test' },
    targetCountries: ['EGY'],
    status: 'PAUSED',
    pauseReason: 'BUDGET_EXHAUSTED',
    walletId: new mongoose.Types.ObjectId(),
  });

  suspendedCampaign = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Suspended Campaign',
    contentType: 'CLIPPING',
    category: 'CLIPPING',
    totalBudget: 1000,
    remainingBudget: 500,
    cpm: 1.5,
    brief: { mainIdea: 'Test' },
    targetCountries: ['SAU'],
    status: 'ACTIVE',
    isSuspended: true,
    walletId: new mongoose.Types.ObjectId(),
  });
});

// ============================================
// GET /campaigns/discover
// ============================================
describe('GET /api/v1/campaigns/discover', () => {
  it('✅ يرجع الحملات النشطة فقط', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const ids = res.body.data.map((c) => c.id);
    expect(ids).toContain(activeCampaign._id.toString());
    expect(ids).not.toContain(suspendedCampaign._id.toString());
  });

  it('✅ الحملة paused بسبب BUDGET_EXHAUSTED تظهر كـ UNAVAILABLE', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover')
      .set('Authorization', `Bearer ${clipperToken}`);

    const paused = res.body.data.find(
      (c) => c.id === pausedCampaign._id.toString()
    );
    expect(paused).toBeDefined();
    expect(paused.availability).toBe('UNAVAILABLE');
    expect(paused.unavailableReason).toBe('BUDGET_EXHAUSTED');
  });

  it('❌ BRAND: 403', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون token: 401', async () => {
    const res = await request(app).get('/api/v1/campaigns/discover');
    expect(res.statusCode).toBe(401);
  });

  it('✅ فلترة بـ contentType=UGC', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover?contentType=UGC')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);

    // ✅ نتأكد أن المصفوفة ليست فارغة (وإلا every ترجع true زوراً)
    expect(res.body.data.length).toBeGreaterThan(0);

    const all = res.body.data.every(
      (c) => c.contentType === 'UGC' || c.subCategories?.includes('UGC')
    );
    expect(all).toBe(true);

    // ✅ تأكيد إضافي: الحملة النشطة (CLIPPING) غير موجودة
    const ids = res.body.data.map((c) => c.id);
    expect(ids).not.toContain(activeCampaign._id.toString());
    // ✅ الحملة paused (UGC) موجودة
    expect(ids).toContain(pausedCampaign._id.toString());
  });

  it('✅ فلترة بـ countries=EGY', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover?countries=EGY')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);

    // ✅ نتأكد أن المصفوفة ليست فارغة
    expect(res.body.data.length).toBeGreaterThan(0);

    const hasEgy = res.body.data.every((c) =>
      c.targetCountries?.includes('EGY')
    );
    expect(hasEgy).toBe(true);

    // ✅ تأكيد إضافي: الحملة النشطة (SAU/ARE) غير موجودة
    const ids = res.body.data.map((c) => c.id);
    expect(ids).not.toContain(activeCampaign._id.toString());
  });

  it('✅ فلترة بـ minCpm و maxCpm', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover?minCpm=1&maxCpm=2')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);

    // ✅ نتأكد أن المصفوفة ليست فارغة
    expect(res.body.data.length).toBeGreaterThan(0);

    const inRange = res.body.data.every((c) => c.cpm >= 1 && c.cpm <= 2);
    expect(inRange).toBe(true);
  });

  it('✅ البحث باسم الحملة', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover?search=Active')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    const hasMatch = res.body.data.some((c) =>
      c.name.toLowerCase().includes('active')
    );
    expect(hasMatch).toBe(true);
  });
});

// ============================================
// GET /campaigns/discover/suggestions
// ============================================
describe('GET /api/v1/campaigns/discover/suggestions', () => {
  it('✅ يرجع اقتراحات لحملة موجودة', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover/suggestions?q=active')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('❌ q أقصر من حرفين: 400', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover/suggestions?q=a')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(400);
  });

  it('❌ بدون q: 400', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/discover/suggestions')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(400);
  });
});

// ============================================
// GET /campaigns/:campaignId/details
// ============================================
describe('GET /api/v1/campaigns/:campaignId/details', () => {
  it('✅ يرجع تفاصيل الحملة النشطة', async () => {
    const res = await request(app)
      .get(`/api/v1/campaigns/${activeCampaign._id}/details`)
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(activeCampaign._id.toString());
    expect(res.body.data.canApply).toBe(true);
    expect(res.body.data.applyBlockedReason).toBeNull();
  });

  it('❌ حملة موقوفة: 404 (لا تُكشف)', async () => {
    const res = await request(app)
      .get(`/api/v1/campaigns/${suspendedCampaign._id}/details`)
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('❌ campaignId غير صحيح الصيغة: 400', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns/invalid-id/details')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(400);
  });

});