// src/tests/campaignCreation.test.js
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const generateToken = require('../utils/generateTokens');
const { AI_REVIEW_RESULT } = require('../constants/campaign.constants');

// ⚠️ منعمل mock كامل لملف aiReview.service — عشان نتحكم بنتيجة "الذكاء الاصطناعي"
// بكل اختبار لحاله (approved / rejected / manual review / فشل)، بدل ما نعتمد
// على استدعاء شبكة فعلي أو على الـ mock الداخلي الثابت (يلي دايمًا APPROVED)
jest.mock('../services/campaign/aiReview.service');
const aiReviewService = require('../services/campaign/aiReview.service');

let mongoServer;
let brandUser;
let brandToken;

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
  jest.clearAllMocks();

  brandUser = await User.create({
    fullName: 'Brand Owner',
    email: 'brand@example.com',
    password: 'hashedPassword123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);
});

// بيانات حملة كاملة وصحيحة، جاهزة نعدل عليها حسب كل اختبار
const validCampaignPayload = () => ({
  name: 'Ramadan Campaign 2026',
  contentType: 'UGC',
  category: 'UGC',
  totalBudget: 5000,
  cpm: 10,
  brief: {
    mainIdea: 'الترويج لمنتج جديد خلال شهر رمضان',
  },
  targetCountries: ['SAU', 'EGY'],
  halalDeclaration: {
    noGambling: true,
    noSexualContent: true,
    noExplicitMusic: true,
    noAlcohol: true,
    noSuspiciousCurrencies: true,
    noUnrealisticProfit: true,
  },
});

describe('POST /api/v1/campaigns', () => {
  // ============================================
  // 8.1.1 — Happy path
  // ============================================
  it('لازم ينشئ حملة بنجاح ويرسلها فورًا للمراجعة (happy path)', async () => {
    aiReviewService.reviewCampaign.mockResolvedValue({
      result: AI_REVIEW_RESULT.APPROVED,
      score: 95,
      feedback: 'Looks great',
    });
    aiReviewService.mapAIResultToStatus.mockReturnValue('ACTIVE');

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(validCampaignPayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.campaign.status).toBe('ACTIVE');
    expect(res.body.campaign.remainingBudget).toBe(5000);
  });

  // ============================================
  // 8.1.2 — Validation errors
  // ============================================
  it('لازم يرفض الطلب لو حقول أساسية ناقصة', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ name: 'Incomplete Campaign' }); // باقي الحقول ناقصة

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('لازم يرفض MIXED بدون subCategories', async () => {
    const payload = validCampaignPayload();
    payload.contentType = 'MIXED';
    payload.category = 'MIXED';
    // subCategories مش موجودة أصلاً

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'subCategories')).toBe(true);
  });

  // ============================================
  // 8.1.3 — Halal declaration غير مكتملة
  // ============================================
  it('لازم يرفض الحملة لو إعلان الحلال مش كامل', async () => {
    const payload = validCampaignPayload();
    payload.halalDeclaration.noAlcohol = false; // شرط واحد بس فالص

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'halalDeclaration')).toBe(true);
  });

  // ============================================
  // 8.1.4 — رفع ملفات (نوع ممنوع، حجم كبير)
  // ============================================
  it('لازم يرفض ملف بنوع غير مسموح', async () => {
    const payload = validCampaignPayload();

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .field('name', payload.name)
      .field('contentType', payload.contentType)
      .field('category', payload.category)
      .field('totalBudget', String(payload.totalBudget))
      .field('cpm', String(payload.cpm))
      .field('brief.mainIdea', payload.brief.mainIdea)
      .field('targetCountries', payload.targetCountries)
      .attach('materials', Buffer.from('not a real file'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.statusCode).toBe(400);
  });

  // ============================================
  // 8.1.5 — AI review: approved scenario
  // ============================================
  it('لازم تصير الحملة ACTIVE لو الـ AI وافق (mock)', async () => {
    aiReviewService.reviewCampaign.mockResolvedValue({
      result: AI_REVIEW_RESULT.APPROVED,
      score: 98,
      feedback: 'Perfect match',
    });
    aiReviewService.mapAIResultToStatus.mockReturnValue('ACTIVE');

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(validCampaignPayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.campaign.status).toBe('ACTIVE');
    expect(res.body.campaign.aiReview.score).toBe(98);
  });

  // ============================================
  // 8.1.6 — AI review: rejected scenario
  // ============================================
  it('لازم تصير الحملة REJECTED لو الـ AI رفض (mock)', async () => {
    aiReviewService.reviewCampaign.mockResolvedValue({
      result: AI_REVIEW_RESULT.REJECTED,
      score: 20,
      feedback: 'Content violates guidelines',
    });
    aiReviewService.mapAIResultToStatus.mockReturnValue('REJECTED');

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(validCampaignPayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.campaign.status).toBe('REJECTED');
  });

  // ============================================
  // 8.1.7 — AI review: manual review scenario
  // ============================================
  it('لازم تصير الحملة MANUAL_REVIEW لو الـ AI مش متأكد (mock)', async () => {
    aiReviewService.reviewCampaign.mockResolvedValue({
      result: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
      score: 55,
      feedback: 'Needs human judgment',
    });
    aiReviewService.mapAIResultToStatus.mockReturnValue('MANUAL_REVIEW');

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(validCampaignPayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.campaign.status).toBe('MANUAL_REVIEW');
  });

  // ============================================
  // 8.1.8 — AI service failure → MANUAL_REVIEW
  // ============================================
  it('لازم تتحول الحملة لـ MANUAL_REVIEW تلقائيًا لو خدمة الـ AI فشلت بالكامل', async () => {
    aiReviewService.reviewCampaign.mockRejectedValue(new Error('AI service timeout'));

    // handleAIServiceFailure الحقيقية بتعدل الحملة وتحفظها — منخليها تشتغل فعليًا
    // (مش mock)، عشان نتأكد التكامل الحقيقي بين الملفين شغال
    const actualAiReview = jest.requireActual('../services/campaign/aiReview.service');
    aiReviewService.handleAIServiceFailure.mockImplementation(actualAiReview.handleAIServiceFailure);

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .send(validCampaignPayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.campaign.status).toBe('MANUAL_REVIEW');

    // نتأكد كمان إنها فعليًا انحفظت هيك بقاعدة البيانات
    const savedCampaign = await Campaign.findById(res.body.campaign._id);
    expect(savedCampaign.status).toBe('MANUAL_REVIEW');
  });

  it('لازم يرفض الطلب بدون توكن', async () => {
    const res = await request(app).post('/api/v1/campaigns').send(validCampaignPayload());

    expect(res.statusCode).toBe(401);
  });

  it('لازم يرفض الطلب لو المستخدم مش BRAND', async () => {
    const clipperUser = await User.create({
      fullName: 'Clipper User',
      email: 'clipper@example.com',
      password: 'hashedPassword123',
      role: 'CLIPPER',
    });
    const clipperToken = generateToken(clipperUser._id, clipperUser.role);

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send(validCampaignPayload());

    expect(res.statusCode).toBe(403);
  });
});