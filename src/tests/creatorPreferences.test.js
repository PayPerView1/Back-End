// src/tests/creatorPreferences.test.js
// المالك: الشخص B — اختبارات تفضيلات المبدع.
// المرجع: API_CONTRACT_Sprint4.md §2.2-2.3

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/user');
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
});

// ============================================
// GET /creator/preferences
// ============================================
describe('GET /api/v1/creator/preferences', () => {
  it('✅ يرجع الافتراضيات إذا ما في مستند', async () => {
    const res = await request(app)
      .get('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.preferredContentTypes).toEqual([]);
    expect(res.body.data.preferredCountries).toEqual([]);
    expect(res.body.data.minCpm).toBe(0);
    expect(res.body.data.updatedAt).toBeNull();
  });

  it('✅ يرجع التفضيلات المحفوظة', async () => {
    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['CLIPPING'],
      preferredCountries: ['SAU', 'EGY'],
      minCpm: 1.5,
    });

    const res = await request(app)
      .get('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.preferredContentTypes).toEqual(['CLIPPING']);
    expect(res.body.data.preferredCountries).toEqual(['SAU', 'EGY']);
    expect(res.body.data.minCpm).toBe(1.5);
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('❌ BRAND: 403', async () => {
    const res = await request(app)
      .get('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون token: 401', async () => {
    const res = await request(app).get('/api/v1/creator/preferences');
    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// PUT /creator/preferences
// ============================================
describe('PUT /api/v1/creator/preferences', () => {
  it('✅ يحفظ التفضيلات (upsert - أول مرة)', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({
        preferredContentTypes: ['CLIPPING', 'UGC'],
        preferredCountries: ['SAU', 'EGY'],
        minCpm: 1.0,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.preferredContentTypes).toEqual(['CLIPPING', 'UGC']);
    expect(res.body.data.preferredCountries).toEqual(['SAU', 'EGY']);
    expect(res.body.data.minCpm).toBe(1.0);

    // تحقق من DB
    const prefs = await CreatorPreferences.findOne({
      creatorId: clipperUser._id,
    });
    expect(prefs).toBeDefined();
    expect(prefs.preferredCountries).toEqual(['SAU', 'EGY']);
  });

  it('✅ يستبدل التفضيلات بالكامل (تحديث)', async () => {
    await CreatorPreferences.create({
      creatorId: clipperUser._id,
      preferredContentTypes: ['UGC'],
      preferredCountries: ['SAU'],
      minCpm: 5,
    });

    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({
        preferredContentTypes: ['CLIPPING'],
        preferredCountries: ['EGY'],
        minCpm: 2,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.preferredContentTypes).toEqual(['CLIPPING']);
    expect(res.body.data.preferredCountries).toEqual(['EGY']);
    expect(res.body.data.minCpm).toBe(2);
  });

  it('✅ يحول alpha-2 إلى alpha-3', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({
        preferredContentTypes: [],
        preferredCountries: ['SA', 'EG'], // alpha-2
        minCpm: 0,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.preferredCountries).toEqual(['SAU', 'EGY']); // alpha-3
  });

  it('✅ مصفوفات فاضية مقبولة', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({
        preferredContentTypes: [],
        preferredCountries: [],
        minCpm: 0,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.preferredContentTypes).toEqual([]);
    expect(res.body.data.preferredCountries).toEqual([]);
  });

  it('❌ minCpm سالب: 400', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({
        minCpm: -1,
      });

    expect(res.statusCode).toBe(400);
  });

  it('❌ contentType غير صحيح: 400', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({
        preferredContentTypes: ['INVALID_TYPE'],
      });

    expect(res.statusCode).toBe(400);
  });

  it('❌ BRAND: 403', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({
        preferredContentTypes: ['CLIPPING'],
      });

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون token: 401', async () => {
    const res = await request(app)
      .put('/api/v1/creator/preferences')
      .send({ preferredContentTypes: [] });

    expect(res.statusCode).toBe(401);
  });
});