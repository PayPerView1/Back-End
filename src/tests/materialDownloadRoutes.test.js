// src/tests/materialDownloadRoutes.test.js
// A5.3 — اختبارات supertest لمساري إصدار روابط التنزيل:
//   POST /api/v1/applications/:id/materials/:materialId/download-link
//   POST /api/v1/applications/:id/materials/download-all
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const db = require('./helpers/db');
const f = require('./helpers/factories');
const DownloadLog = require('../models/downloadLog');
const Campaign = require('../models/campaign');
const { CAMPAIGN_STATUS } = require('../constants/campaign.constants');

jest.mock('../services/emailService');

// app.js يسجّل كل الموديلات، وdb.connect يبني فهارسها على قاعدة بيانات بعيدة — يحتاج وقتًا أطول.
jest.setTimeout(30000);

const RAW_URL = 'https://res.cloudinary.com/demo/video/upload/v1/campaign-materials/intro.mp4';
const BASE = '/api/v1';

beforeAll(db.connect, 120000);
afterAll(db.disconnect, 120000);
afterEach(db.clearDatabase, 120000);

beforeEach(() => {
  process.env.DOWNLOAD_LINK_SECRET = process.env.DOWNLOAD_LINK_SECRET || 'download-secret-for-tests';
  process.env.BACKEND_URL = 'https://api.example.com';
});

const material = (brand, n) => ({
  fileName: `file-${n}.mp4`,
  fileUrl: RAW_URL,
  fileType: 'VIDEO',
  fileSizeKb: 1000 * n,
  mimeType: 'video/mp4',
  uploadedBy: brand._id,
  publicId: `campaign-materials/file-${n}`,
  resourceType: 'video',
});

const setup = async ({ materials = 2, applicationOverrides = {}, campaignOverrides = {} } = {}) => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, {
    materials: Array.from({ length: materials }, (_, i) => material(brand, i + 1)),
    ...campaignOverrides,
  });
  const application = await f.createAcceptedApplication(creator, campaign, applicationOverrides);
  return { brand, creator, campaign, application };
};

const linkUrl = (applicationId, materialId) =>
  `${BASE}/applications/${applicationId}/materials/${materialId}/download-link`;
const allUrl = (applicationId) => `${BASE}/applications/${applicationId}/materials/download-all`;

describe('POST /applications/:id/materials/:materialId/download-link', () => {
  test('ينشئ سجلاً بحالة REQUESTED ويعيد رابطاً موقّعاً', async () => {
    const s = await setup();
    const materialId = s.campaign.materials[0]._id;

    const res = await request(app)
      .post(linkUrl(s.application._id, materialId))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(Object.keys(data).sort()).toEqual(
      ['expiresAt', 'fileName', 'fileSizeKb', 'logId', 'materialId', 'url'].sort()
    );
    expect(data.fileName).toBe('file-1.mp4');
    expect(data.fileSizeKb).toBe(1000);
    expect(String(data.materialId)).toBe(String(materialId));
    expect(data.url.startsWith('https://api.example.com/api/v1/materials/download/')).toBe(true);

    // لا يُسرَّب المصدر الأصلي
    expect(data.url).not.toContain('res.cloudinary.com');
    expect(data).not.toHaveProperty('fileUrl');
    expect(data).not.toHaveProperty('publicId');

    const log = await DownloadLog.findById(data.logId);
    expect(log).not.toBeNull();
    expect(log.status).toBe('REQUESTED');
    expect(String(log.creatorId)).toBe(String(s.creator._id));
    expect(String(log.campaignId)).toBe(String(s.campaign._id));
    expect(String(log.applicationId)).toBe(String(s.application._id));
    expect(String(log.materialId)).toBe(String(materialId));
    expect(log.consumedAt).toBeNull();
  });

  test('مادة غير موجودة في الحملة ⇒ 404 NOT_FOUND', async () => {
    const s = await setup();
    const strangerMaterialId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(linkUrl(s.application._id, strangerMaterialId))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.message).toBe('Material not found');
  });

  test('طلب غير مقبول ⇒ 403 APPLICATION_NOT_ACCEPTED', async () => {
    const s = await setup({ applicationOverrides: { status: 'PENDING' } });

    const res = await request(app)
      .post(linkUrl(s.application._id, s.campaign.materials[0]._id))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('APPLICATION_NOT_ACCEPTED');
  });

  test('طلب مبدع آخر ⇒ 404 NOT_FOUND (لا نكشف وجوده)', async () => {
    const s = await setup();
    const other = await f.createUser();

    const res = await request(app)
      .post(linkUrl(s.application._id, s.campaign.materials[0]._id))
      .set(f.authHeader(other));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('حملة ملغاة ⇒ 409 CAMPAIGN_UNAVAILABLE', async () => {
    const s = await setup();
    await Campaign.updateOne({ _id: s.campaign._id }, { $set: { status: CAMPAIGN_STATUS.CANCELLED } });

    const res = await request(app)
      .post(linkUrl(s.application._id, s.campaign.materials[0]._id))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_UNAVAILABLE');
  });

  test('دور BRAND ممنوع ⇒ 403', async () => {
    const s = await setup();

    const res = await request(app)
      .post(linkUrl(s.application._id, s.campaign.materials[0]._id))
      .set(f.authHeader(s.brand));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('بدون توكن ⇒ 401', async () => {
    const s = await setup();

    const res = await request(app).post(linkUrl(s.application._id, s.campaign.materials[0]._id));

    expect(res.status).toBe(401);
  });

  test('معرّف غير صالح ⇒ 400 VALIDATION_ERROR', async () => {
    const s = await setup();

    const res = await request(app)
      .post(`${BASE}/applications/abc/materials/download-all`)
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

describe('POST /applications/:id/materials/download-all', () => {
  test('يعيد رابطاً لكل ملف مع الاستراتيجية والحجم الكلي', async () => {
    const s = await setup();

    const res = await request(app)
      .post(allUrl(s.application._id))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.strategy).toBe('FILES');
    expect(res.body.data.totalSizeKb).toBe(3000);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0].url).not.toContain('res.cloudinary.com');

    // سجل لكل ملف، كلها REQUESTED
    const logs = await DownloadLog.find({ creatorId: s.creator._id });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.status === 'REQUESTED')).toBe(true);
  });

  test('حملة بلا مواد ⇒ 201 مع items فارغة', async () => {
    const s = await setup({ materials: 0 });

    const res = await request(app)
      .post(allUrl(s.application._id))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ strategy: 'FILES', totalSizeKb: 0, items: [] });
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });

  test('طلب غير مقبول ⇒ 403 APPLICATION_NOT_ACCEPTED', async () => {
    const s = await setup({ applicationOverrides: { status: 'REJECTED' } });

    const res = await request(app)
      .post(allUrl(s.application._id))
      .set(f.authHeader(s.creator));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('APPLICATION_NOT_ACCEPTED');
  });
});
