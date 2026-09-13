// src/tests/campaignDraft.test.js
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const CampaignDraft = require('../models/CampaignDraft');
const generateToken = require('../utils/generateTokens');
const { AI_REVIEW_RESULT } = require('../constants/campaign.constants');

jest.mock('../services/campaign/aiReview.service');
const aiReviewService = require('../services/campaign/aiReview.service');

let mongoServer;
let brandUser;
let brandToken;
let otherBrandUser;
let otherBrandToken;

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
  await CampaignDraft.deleteMany({});
  jest.clearAllMocks();

  brandUser = await User.create({
    fullName: 'Brand Owner',
    email: 'brand@example.com',
    password: 'hashedPassword123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);

  otherBrandUser = await User.create({
    fullName: 'Other Brand',
    email: 'other-brand@example.com',
    password: 'hashedPassword123',
    role: 'BRAND',
  });
  otherBrandToken = generateToken(otherBrandUser._id, otherBrandUser.role);
});

const fullHalalDeclaration = () => ({
  noGambling: true,
  noSexualContent: true,
  noExplicitMusic: true,
  noAlcohol: true,
  noSuspiciousCurrencies: true,
  noUnrealisticProfit: true,
});

// ============================================
// 8.2.1 & 8.2.2 — POST /api/v1/campaigns/drafts
// ============================================
describe('POST /api/v1/campaigns/drafts', () => {
  it('لازم يرفض بدون name (400)', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns/drafts')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
  });

  it('لازم ينشئ مسودة بنجاح (happy path)', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns/drafts')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ name: 'My First Draft' });

    expect(res.statusCode).toBe(201);
    expect(res.body.draft.name).toBe('My First Draft');
    expect(res.body.draft.version).toBe(1);
  });
});

// ============================================
// 8.2.3 — GET /:id — ownership check
// ============================================
describe('GET /api/v1/campaigns/drafts/:draftId', () => {
  it('لازم يرفض الوصول لمسودة مستخدم تاني (403)', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Private Draft',
    });

    const res = await request(app)
      .get(`/api/v1/campaigns/drafts/${draft._id}`)
      .set('Authorization', `Bearer ${otherBrandToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('لازم يرجع 404 لمسودة مش موجودة', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/v1/campaigns/drafts/${fakeId}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('لازم يرجع المسودة لصاحبها بنجاح', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'My Draft',
    });

    const res = await request(app)
      .get(`/api/v1/campaigns/drafts/${draft._id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.draft.name).toBe('My Draft');
  });
});

// ============================================
// 8.2.4 & 8.2.5 — PUT /:id
// ============================================
describe('PUT /api/v1/campaigns/drafts/:draftId', () => {
  it('لازم يحدث المسودة بنجاح ويزيد الـ version', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Draft to update',
    });

    const res = await request(app)
      .put(`/api/v1/campaigns/drafts/${draft._id}`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ totalBudget: 3000, cpm: 5 });

    expect(res.statusCode).toBe(200);
    expect(res.body.draft.totalBudget).toBe(3000);
    expect(res.body.draft.version).toBe(2); // كانت 1، صارت 2
  });

  it('لازم يرفض تحديث مسودة منتهية الصلاحية (400)', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Expired Draft',
      status: 'EXPIRED',
    });

    const res = await request(app)
      .put(`/api/v1/campaigns/drafts/${draft._id}`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ totalBudget: 1000 });

    expect(res.statusCode).toBe(400);
  });
});

// ============================================
// 8.2.6 — PATCH auto-save — version conflict
// ============================================
describe('PATCH /api/v1/campaigns/drafts/:draftId/auto-save', () => {
  it('لازم يرفض بـ 409 لو clientVersion أقل من النسخة الحالية', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Conflict Draft',
      version: 3, // النسخة الحالية بقاعدة البيانات أعلى
    });

    const res = await request(app)
      .patch(`/api/v1/campaigns/drafts/${draft._id}/auto-save`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ clientVersion: 1, totalBudget: 2000 }); // العميل عنده نسخة قديمة

    expect(res.statusCode).toBe(409);
  });

  it('لازم ينجح الحفظ التلقائي لو clientVersion محدثة', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Auto-save Draft',
      version: 1,
    });

    const res = await request(app)
      .patch(`/api/v1/campaigns/drafts/${draft._id}/auto-save`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ clientVersion: 1, totalBudget: 2000 });

    expect(res.statusCode).toBe(200);
    expect(res.body.draft.version).toBe(2);
  });
});

// ============================================
// 8.2.7 — DELETE
// ============================================
describe('DELETE /api/v1/campaigns/drafts/:draftId', () => {
  it('لازم يحذف المسودة بنجاح', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Draft to delete',
    });

    const res = await request(app)
      .delete(`/api/v1/campaigns/drafts/${draft._id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);

    const stillExists = await CampaignDraft.findById(draft._id);
    expect(stillExists).toBeNull();
  });
});

// ============================================
// 8.2.8 & 8.2.9 — POST /submit
// ============================================
describe('POST /api/v1/campaigns/drafts/:draftId/submit', () => {
  it('لازم يرفض التسليم لو المسودة ناقصة (400 + قائمة الحقول الناقصة)', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Incomplete Draft',
      // باقي الحقول (budget, brief, targetCountries...) ناقصة
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/drafts/${draft._id}/submit`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ halalDeclaration: fullHalalDeclaration() });

    expect(res.statusCode).toBe(400);
    expect(res.body.missingFields).toBeDefined();
    expect(res.body.missingFields.length).toBeGreaterThan(0);
  });

  it('لازم يحول المسودة المكتملة لحملة فعلية بنجاح', async () => {
    aiReviewService.reviewCampaign.mockResolvedValue({
      result: AI_REVIEW_RESULT.APPROVED,
      score: 90,
      feedback: 'Good to go',
    });
    aiReviewService.mapAIResultToStatus.mockReturnValue('ACTIVE');

    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Complete Draft',
      contentType: 'UGC',
      category: 'UGC',
      totalBudget: 4000,
      cpm: 8,
      brief: { mainIdea: 'فكرة الحملة الرئيسية' },
      targetCountries: ['SAU'],
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/drafts/${draft._id}/submit`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ halalDeclaration: fullHalalDeclaration() });

    expect(res.statusCode).toBe(201);
    expect(res.body.campaign.status).toBe('ACTIVE');

    // المسودة المفروض تكون انحذفت بعد التحويل الناجح
    const draftStillExists = await CampaignDraft.findById(draft._id);
    expect(draftStillExists).toBeNull();

    // والحملة الجديدة فعليًا موجودة بقاعدة البيانات
    const newCampaign = await Campaign.findById(res.body.campaign._id);
    expect(newCampaign).not.toBeNull();
    expect(newCampaign.name).toBe('Complete Draft');
  });

  it('لازم يرفض تسليم مسودة مستخدم تاني (403)', async () => {
    const draft = await CampaignDraft.create({
      advertiserId: brandUser._id,
      name: 'Not yours',
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/drafts/${draft._id}/submit`)
      .set('Authorization', `Bearer ${otherBrandToken}`)
      .send({ halalDeclaration: fullHalalDeclaration() });

    expect(res.statusCode).toBe(403);
  });
});