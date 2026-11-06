// src/tests/materialDownloadRedeem.test.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./helpers/db');
const f = require('./helpers/factories');
const DownloadLog = require('../models/downloadLog');
const Campaign = require('../models/campaign');
const Application = require('../models/application');
const {
  createDownloadLink,
  redeemDownload,
  markFailed,
  getAllowedSourceUrl,
} = require('../services/material/materialDownload.service');

// قاعدة البيانات حقيقية (MONGO_URI_TEST) وليست في الذاكرة، فزمن كل حالة يتأثر بالشبكة.
// 10s كانت ضيقة: الحالات العشر وحدها تستغرق ~38s، فآخر حالة تتجاوز المهلة أحياناً.
jest.setTimeout(50000);
beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(db.clearDatabase);
beforeEach(() => {
  process.env.DOWNLOAD_LINK_SECRET = 'download-secret-for-tests';
  process.env.BACKEND_URL = 'https://api.example.com';
});

const RAW_URL = 'https://res.cloudinary.com/demo/video/upload/v1/campaign-materials/intro.mp4';

const setup = async () => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, {
    materials: [
      {
        fileName: 'intro.mp4',
        fileUrl: RAW_URL,
        fileType: 'VIDEO',
        fileSizeKb: 8200,
        mimeType: 'video/mp4',
        uploadedBy: brand._id,
        publicId: 'campaign-materials/intro',
        resourceType: 'video',
      },
    ],
  });
  const application = await f.createAcceptedApplication(creator, campaign);
  return { brand, creator, campaign, application, materialId: campaign.materials[0]._id };
};

// يصدر رابطاً حقيقياً عبر الخدمة ويستخرج التوكن منه
const issue = async (s) => {
  const item = await createDownloadLink({
    applicationId: s.application._id,
    materialId: s.materialId,
    creatorId: s.creator._id,
  });
  return { token: item.url.split('/').pop(), logId: item.logId };
};

const redeem = (s, token, creatorId = s.creator._id) => redeemDownload({ token, creatorId });
const logOf = (logId) => DownloadLog.findById(logId);
const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

describe('redeemDownload: النجاح', () => {
  test('يرجع المصدر الداخلي ويحوّل السجل إلى STARTED', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);

    const prepared = await redeem(s, token);
    expect(Object.keys(prepared).sort()).toEqual(['campaign', 'log', 'material', 'sourceUrl']);
    expect(prepared.sourceUrl).toBe(RAW_URL);
    expect(prepared.material).toEqual({ fileName: 'intro.mp4', mimeType: 'video/mp4', fileSizeKb: 8200 });
    expect(Object.keys(prepared.campaign).sort()).toEqual(['_id', 'name']);

    const log = await logOf(logId);
    expect(log.status).toBe('STARTED');
    expect(log.consumedAt instanceof Date).toBe(true);
  });

  test('يقبل creatorId كنص أيضاً', async () => {
    const s = await setup();
    const { token } = await issue(s);
    expect((await redeem(s, token, String(s.creator._id))).sourceUrl).toBe(RAW_URL);
  });
});

describe('redeemDownload: الرابط', () => {
  test('إعادة الاستعمال: DOWNLOAD_LINK_EXPIRED والسجل لا يتغير', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await redeem(s, token);

    const error = await errorOf(redeem(s, token));
    expect(error.code).toBe('DOWNLOAD_LINK_EXPIRED');
    expect((await logOf(logId)).status).toBe('STARTED');
  });

  test('منتهٍ في قاعدة البيانات: DOWNLOAD_LINK_EXPIRED ولا يُستهلك', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await DownloadLog.updateOne({ _id: logId }, { $set: { linkExpiresAt: new Date(Date.now() - 1000) } });

    expect((await errorOf(redeem(s, token))).code).toBe('DOWNLOAD_LINK_EXPIRED');
    const log = await logOf(logId);
    expect(log.status).toBe('REQUESTED');
    expect(log.consumedAt).toBeNull();
  });

  test('توكن منتهٍ: DOWNLOAD_LINK_EXPIRED بلا لمس للسجل', async () => {
    const s = await setup();
    const { logId } = await issue(s);
    const expired = jwt.sign(
      { lid: String(logId), uid: String(s.creator._id), exp: Math.floor(Date.now() / 1000) - 5 },
      process.env.DOWNLOAD_LINK_SECRET
    );
    expect((await errorOf(redeem(s, expired))).code).toBe('DOWNLOAD_LINK_EXPIRED');
    expect((await logOf(logId)).status).toBe('REQUESTED');
  });

  test('توكنات تالفة: FORBIDDEN', async () => {
    const s = await setup();
    for (const bad of ['', 'abc', 'a.b.c', undefined]) {
      expect((await errorOf(redeem(s, bad))).code).toBe('FORBIDDEN');
    }
  });

  test('مبدع آخر: FORBIDDEN، والسجل لا يُستهلك، والمالك يبقى قادراً على استعمال رابطه', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    const other = await f.createUser();

    expect((await errorOf(redeem(s, token, other._id))).code).toBe('FORBIDDEN');
    const untouched = await logOf(logId);
    expect(untouched.status).toBe('REQUESTED');
    expect(untouched.consumedAt).toBeNull();

    expect((await redeem(s, token)).sourceUrl).toBe(RAW_URL);
  });

  test('طلبان متزامنان بنفس الرابط: ينجح واحد فقط', async () => {
    const s = await setup();
    const { token } = await issue(s);

    const results = await Promise.allSettled([redeem(s, token), redeem(s, token)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected.reason.code).toBe('DOWNLOAD_LINK_EXPIRED');
  });
});

describe('redeemDownload: إعادة فحص الوصول بعد الإصدار', () => {
  test('رُفض الطلب بعد الإصدار: APPLICATION_NOT_ACCEPTED و FAILED ACCESS_REVOKED', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await Application.updateOne({ _id: s.application._id }, { $set: { status: 'REJECTED' } });

    expect((await errorOf(redeem(s, token))).code).toBe('APPLICATION_NOT_ACCEPTED');
    const log = await logOf(logId);
    expect(log.status).toBe('FAILED');
    expect(log.failureReason).toBe('ACCESS_REVOKED');
  });

  test('حُذف الطلب: NOT_FOUND و FAILED ACCESS_REVOKED', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await Application.deleteOne({ _id: s.application._id });

    expect((await errorOf(redeem(s, token))).code).toBe('NOT_FOUND');
    expect((await logOf(logId)).failureReason).toBe('ACCESS_REVOKED');
  });

  test.each([
    ['ملغاة', { status: 'CANCELLED' }],
    ['موقوفة بسبب بلاغ', { isSuspended: true }],
    ['مؤرشفة', { isArchived: true }],
  ])('حملة %s بعد الإصدار: CAMPAIGN_UNAVAILABLE', async (_label, overrides) => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await Campaign.updateOne({ _id: s.campaign._id }, { $set: overrides });

    expect((await errorOf(redeem(s, token))).code).toBe('CAMPAIGN_UNAVAILABLE');
    const log = await logOf(logId);
    expect(log.status).toBe('FAILED');
    expect(log.failureReason).toBe('ACCESS_REVOKED');
  });

  test('حملة محذوفة: NOT_FOUND', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await Campaign.deleteOne({ _id: s.campaign._id });

    expect((await errorOf(redeem(s, token))).code).toBe('NOT_FOUND');
    expect((await logOf(logId)).failureReason).toBe('ACCESS_REVOKED');
  });

  test('مادة حُذفت بعد الإصدار: NOT_FOUND و FAILED MATERIAL_REMOVED', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await Campaign.updateOne({ _id: s.campaign._id }, { $set: { materials: [] } });

    const error = await errorOf(redeem(s, token));
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Material not found');
    expect((await logOf(logId)).failureReason).toBe('MATERIAL_REMOVED');
  });
});

describe('redeemDownload: المصدر', () => {
  test.each([
    'https://evil.example.com/x.mp4',
    'http://res.cloudinary.com/demo/x.mp4',
    'https://res.cloudinary.com.evil.com/x.mp4',
    'https://evil.com/res.cloudinary.com/x.mp4',
    'https://user:pass@res.cloudinary.com/x.mp4',
    'https://res.cloudinary.com:8443/x.mp4',
    'ftp://res.cloudinary.com/x.mp4',
    '//res.cloudinary.com/x.mp4',
    'not a url',
    '',
  ])('مصدر غير مسموح (%s): DOWNLOAD_SOURCE_UNAVAILABLE', async (bad) => {
    const s = await setup();
    const { token, logId } = await issue(s);
    await Campaign.updateOne(
      { _id: s.campaign._id, 'materials._id': s.materialId },
      { $set: { 'materials.$.fileUrl': bad } }
    );

    const error = await errorOf(redeem(s, token));
    expect(error.code).toBe('DOWNLOAD_SOURCE_UNAVAILABLE');
    expect(error.message).toBe('Download source is unavailable'); // لا يُسرَّب الرابط
    const log = await logOf(logId);
    expect(log.status).toBe('FAILED');
    expect(log.failureReason).toBe('INVALID_SOURCE');
  });
});

describe('markFailed و getAllowedSourceUrl', () => {
  test('markFailed لا يكتب فوق COMPLETED ولا يمسّ REQUESTED', async () => {
    const s = await setup();
    const { token, logId } = await issue(s);

    await markFailed(logId, 'X'); // ما زال REQUESTED
    expect((await logOf(logId)).status).toBe('REQUESTED');

    await redeem(s, token);
    await DownloadLog.updateOne({ _id: logId }, { $set: { status: 'COMPLETED' } });
    await markFailed(logId, 'X');
    expect((await logOf(logId)).status).toBe('COMPLETED');
  });

  test('getAllowedSourceUrl', () => {
    expect(getAllowedSourceUrl('https://RES.cloudinary.com/demo/a.mp4')).toBe('https://res.cloudinary.com/demo/a.mp4');
    expect(getAllowedSourceUrl('https://res.cloudinary.com./a.mp4')).toBeNull();
    expect(getAllowedSourceUrl(undefined)).toBeNull();
    expect(getAllowedSourceUrl(123)).toBeNull();
  });
});