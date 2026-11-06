// src/tests/application.test.js
// المالك: الشخص B — اختبارات التقديم (جانب المبدع).
// المرجع: API_CONTRACT_Sprint4.md §4.1-4.4

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
// تم إزالة استيراد MongoMemoryServer

const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const Application = require('../models/application');
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

let clipperUser, clipperToken;
let otherClipper, otherClipperToken;
let brandUser, brandToken;
let activeCampaign;

jest.setTimeout(40000);

beforeAll(async () => {
  // التأكد من وجود رابط قاعدة بيانات الاختبار
  if (!process.env.MONGO_URI_TEST) {
    throw new Error('MONGO_URI_TEST is not defined in .env file');
  }
  
  // الاتصال بقاعدة بيانات الاختبار الحقيقية
  await mongoose.connect(process.env.MONGO_URI_TEST);
});

afterAll(async () => {
  // قطع الاتصال بقاعدة البيانات
  await mongoose.disconnect();
  
  // اختياري: إذا أردت مسح قاعدة البيانات بالكامل بعد انتهاء جميع الاختبارات
  // يمكنك إزالة التعليق عن السطر التالي:
  // await mongoose.connection.dropDatabase();
});

beforeEach(async () => {
  // تنظيف الجداول قبل كل اختبار
  await User.deleteMany({});
  await Campaign.deleteMany({});
  await Application.deleteMany({});
  jest.clearAllMocks();

  clipperUser = await User.create({
    fullName: 'Clipper One',
    email: 'clipper1@test.com',
    password: 'password123',
    role: 'CLIPPER',
  });
  clipperToken = generateToken(clipperUser._id, clipperUser.role);

  otherClipper = await User.create({
    fullName: 'Clipper Two',
    email: 'clipper2@test.com',
    password: 'password123',
    role: 'CLIPPER',
  });
  otherClipperToken = generateToken(otherClipper._id, otherClipper.role);

  brandUser = await User.create({
    fullName: 'Brand Owner',
    email: 'brand@test.com',
    password: 'password123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);

  activeCampaign = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Test Campaign',
    contentType: 'CLIPPING',
    category: 'CLIPPING',
    totalBudget: 1000,
    remainingBudget: 500,
    cpm: 1.5,
    brief: { mainIdea: 'Test brief' },
    targetCountries: ['SAU'],
    status: 'ACTIVE',
    walletId: new mongoose.Types.ObjectId(),
  });
});

// ============================================
// POST /campaigns/:campaignId/apply
// ============================================
describe('POST /api/v1/campaigns/:campaignId/apply', () => {
  it('✅ ينشئ تقديم ناجح', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'I am interested' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');

    // applicantsCount زاد
    const updated = await Campaign.findById(activeCampaign._id);
    expect(updated.applicantsCount).toBe(1);
  });

  it('❌ تقديم مكرر: 409 ALREADY_APPLIED', async () => {
    await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'first' });

    const res = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'second' });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ALREADY_APPLIED');
  });

  it('❌ حملة موقوفة: 409 CAMPAIGN_UNAVAILABLE', async () => {
    await Campaign.findByIdAndUpdate(activeCampaign._id, {
      isSuspended: true,
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_UNAVAILABLE');
  });

  it('❌ BRAND: 403', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ message: 'test' });

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون token: 401', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .send({ message: 'test' });

    expect(res.statusCode).toBe(401);
  });

  it('❌ campaignId غير صحيح: 400', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns/invalid-id/apply')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    expect(res.statusCode).toBe(400);
  });
});

// ============================================
// DELETE /applications/:id
// ============================================
describe('DELETE /api/v1/applications/:id', () => {
  it('✅ سحب طلب PENDING', async () => {
    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const appId = applyRes.body.data.id;

    const res = await request(app)
      .delete(`/api/v1/applications/${appId}`)
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('WITHDRAWN');

    // applicantsCount نقص
    const updated = await Campaign.findById(activeCampaign._id);
    expect(updated.applicantsCount).toBe(0);
  });

  it('❌ طلب مبدع تاني: 404', async () => {
    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const appId = applyRes.body.data.id;

    const res = await request(app)
      .delete(`/api/v1/applications/${appId}`)
      .set('Authorization', `Bearer ${otherClipperToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('❌ طلب ACCEPTED: 409 APPLICATION_NOT_WITHDRAWABLE', async () => {
    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const appId = applyRes.body.data.id;

    await Application.findByIdAndUpdate(appId, { status: 'ACCEPTED' });

    const res = await request(app)
      .delete(`/api/v1/applications/${appId}`)
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('APPLICATION_NOT_WITHDRAWABLE');
  });
});

// ============================================
// GET /applications/my
// ============================================
describe('GET /api/v1/applications/my', () => {
  it('✅ يرجع قائمة فاضية', async () => {
    const res = await request(app)
      .get('/api/v1/applications/my')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('✅ يرجع التقديمات (بدون WITHDRAWN افتراضياً)', async () => {
    // إنشاء تقديم
    await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const res = await request(app)
      .get('/api/v1/applications/my')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('PENDING');
  });

  it('✅ فلترة بـ status=WITHDRAWN', async () => {
    // إنشاء + سحب
    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    await request(app)
      .delete(`/api/v1/applications/${applyRes.body.data.id}`)
      .set('Authorization', `Bearer ${clipperToken}`);

    const res = await request(app)
      .get('/api/v1/applications/my?status=WITHDRAWN')
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('WITHDRAWN');
  });
});

// ============================================
// GET /applications/:id/materials
// ============================================
describe('GET /api/v1/applications/:id/materials', () => {
  it('✅ يرجع المواد للطلب ACCEPTED', async () => {
    const campaignWithMaterial = await Campaign.create({
      advertiserId: brandUser._id,
      name: 'With Materials',
      contentType: 'CLIPPING',
      category: 'CLIPPING',
      totalBudget: 1000,
      remainingBudget: 500,
      cpm: 1.5,
      brief: { mainIdea: 'Test' },
      targetCountries: ['SAU'],
      status: 'ACTIVE',
      walletId: new mongoose.Types.ObjectId(),
      materials: [
        {
          fileName: 'intro.mp4',
          fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/intro.mp4',
          fileType: 'VIDEO',
          fileSizeKb: 5000,
          mimeType: 'video/mp4',
          uploadedBy: brandUser._id,
          publicId: 'demo-intro', 
        resourceType: 'video',
        },
      ],
    });

    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${campaignWithMaterial._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const appId = applyRes.body.data.id;
    await Application.findByIdAndUpdate(appId, { status: 'ACCEPTED' });

    const res = await request(app)
      .get(`/api/v1/applications/${appId}/materials`)
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(200);

    // Sprint 5 §3.1: الاستجابة كائن (summary + items) وليس مصفوفة، وبلا رابط تنزيل
    const data = res.body.data;
    expect(data.applicationId).toBe(String(appId));
    expect(data.campaignId).toBe(String(campaignWithMaterial._id));
    expect(data.summary).toEqual({ count: 1, totalSizeKb: 5000 });
    expect(data.canDownloadAll).toBe(true);

    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      fileName: 'intro.mp4',
      fileType: 'VIDEO',
      mimeType: 'video/mp4',
      fileSizeKb: 5000,
    });
    expect(data.items[0].previewUrl).toContain('w_480,q_auto:low,so_0,du_15');

    // ⚠️ لا يُسرَّب رابط الأصل ولا الـ publicId — التنزيل عبر §3.2/§3.3 فقط
    expect(data.items[0].downloadUrl).toBeUndefined();
    expect(data.items[0].fileUrl).toBeUndefined();
    expect(data.items[0].publicId).toBeUndefined();
  });

  it('❌ طلب PENDING: 403 FORBIDDEN', async () => {
    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const res = await request(app)
      .get(`/api/v1/applications/${applyRes.body.data.id}/materials`)
      .set('Authorization', `Bearer ${clipperToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('APPLICATION_NOT_ACCEPTED');
  });

  it('❌ طلب مبدع تاني: 404', async () => {
    const applyRes = await request(app)
      .post(`/api/v1/campaigns/${activeCampaign._id}/apply`)
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ message: 'test' });

    const res = await request(app)
      .get(`/api/v1/applications/${applyRes.body.data.id}/materials`)
      .set('Authorization', `Bearer ${otherClipperToken}`);

    expect(res.statusCode).toBe(404);
  });
});