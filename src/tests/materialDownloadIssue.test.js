// src/tests/materialDownloadIssue.test.js
require('dotenv').config();
const db = require('./helpers/db');
const f = require('./helpers/factories');
const DownloadLog = require('../models/downloadLog');
const { createDownloadLink, createDownloadAllLinks } = require('../services/material/materialDownload.service');
const { verifyDownloadToken } = require('../utils/material/downloadToken.utils');
const { SUBMISSION_CONFIG } = require('../constants/submission.constants');
const { validate } = require('../middlewares/validate.middleware');
const { downloadLinkParamsSchema, downloadAllParamsSchema } = require('../validators/material/material.validator');

jest.setTimeout(70000);
beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(db.clearDatabase);
beforeEach(() => {
  process.env.DOWNLOAD_LINK_SECRET = 'download-secret-for-tests';
  process.env.BACKEND_URL = 'https://api.example.com';
  delete process.env.IP_HASH_SECRET;
});

const RAW_URL = 'https://res.cloudinary.com/demo/video/upload/v1/campaign-materials/intro.mp4';

const material = (brand, i) => ({
  fileName: `file${i}.mp4`,
  fileUrl: RAW_URL,
  fileType: 'VIDEO',
  fileSizeKb: i * 1000,
  mimeType: 'video/mp4',
  uploadedBy: brand._id,
  publicId: `campaign-materials/file${i}`,
  resourceType: 'video',
});

const setup = async (campaignOverrides = {}, applicationOverrides = {}) => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, {
    materials: [1, 2, 3].map((i) => material(brand, i)),
    ...campaignOverrides,
  });
  const application = await f.createAcceptedApplication(creator, campaign, applicationOverrides);
  return { brand, creator, campaign, application };
};

const baseArgs = (s) => ({
  applicationId: s.application._id,
  creatorId: s.creator._id,
  ip: '203.0.113.9',
  userAgent: 'Mozilla/5.0',
});
const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

describe('createDownloadLink', () => {
  test('ينشئ سجلاً REQUESTED بالحقول الصحيحة ويرجع الشكل المتفق عليه', async () => {
    const s = await setup();
    const target = s.campaign.materials[1];
    const item = await createDownloadLink({ ...baseArgs(s), materialId: target._id });

    expect(Object.keys(item).sort()).toEqual(['expiresAt', 'fileName', 'fileSizeKb', 'logId', 'materialId', 'url']);
    expect(item.fileName).toBe('file2.mp4');
    expect(item.fileSizeKb).toBe(2000);

    const log = await DownloadLog.findById(item.logId);
    expect(log.status).toBe('REQUESTED');
    expect(log.type).toBe('FILE');
    expect(String(log.applicationId)).toBe(String(s.application._id));
    expect(String(log.campaignId)).toBe(String(s.campaign._id));
    expect(String(log.creatorId)).toBe(String(s.creator._id));
    expect(String(log.materialId)).toBe(String(target._id));
    expect(log.fileName).toBe('file2.mp4');
    expect(log.fileSizeKb).toBe(2000);
    expect(log.consumedAt).toBeNull();
  });

  test('انتهاء السجل يساوي انتهاء الرابط ويساوي الآن + TTL', async () => {
    const s = await setup();
    const item = await createDownloadLink({ ...baseArgs(s), materialId: s.campaign.materials[0]._id });
    const log = await DownloadLog.findById(item.logId);

    expect(log.linkExpiresAt.getTime()).toBe(item.expiresAt.getTime());
    const seconds = Math.round((item.expiresAt.getTime() - Date.now()) / 1000);
    expect(Math.abs(seconds - SUBMISSION_CONFIG.DOWNLOAD_LINK_TTL_SECONDS) <= 3).toBe(true);
  });

  test('التوكن داخل الرابط يطابق السجل والمبدع', async () => {
    const s = await setup();
    const item = await createDownloadLink({ ...baseArgs(s), materialId: s.campaign.materials[0]._id });

    expect(item.url.startsWith('https://api.example.com/api/v1/materials/download/')).toBe(true);
    const claims = verifyDownloadToken(item.url.split('/').pop());
    expect(claims).toEqual({ logId: String(item.logId), creatorId: String(s.creator._id) });
  });

  test('لا تسريب: لا fileUrl ولا publicId ولا الرابط الأصلي', async () => {
    const s = await setup();
    const item = await createDownloadLink({ ...baseArgs(s), materialId: s.campaign.materials[0]._id });
    const json = JSON.stringify(item);
    ['fileUrl', 'publicId', RAW_URL, 'campaign-materials/file1'].forEach((needle) => {
      expect(json.includes(needle)).toBe(false);
    });
  });

  test('IP يُجزَّأ عند ضبط IP_HASH_SECRET (وإلا null)، و userAgent يُقصّ عند 200', async () => {
    const s = await setup();
    const materialId = s.campaign.materials[0]._id;

    const plain = await createDownloadLink({ ...baseArgs(s), materialId });
    expect((await DownloadLog.findById(plain.logId).select('+ipHash')).ipHash).toBeNull();

    process.env.IP_HASH_SECRET = 'ip-secret';
    const hashed = await createDownloadLink({ ...baseArgs(s), materialId, userAgent: 'x'.repeat(500) });
    const log = await DownloadLog.findById(hashed.logId).select('+ipHash');
    expect(/^[a-f0-9]{64}$/.test(log.ipHash)).toBe(true);
    expect(log.ipHash).not.toBe('203.0.113.9');
    expect(log.userAgent).toHaveLength(200);
  });

  test('كل طلب يُصدر رابطاً وسجلاً جديدين', async () => {
    const s = await setup();
    const materialId = s.campaign.materials[0]._id;
    const a = await createDownloadLink({ ...baseArgs(s), materialId });
    const b = await createDownloadLink({ ...baseArgs(s), materialId });
    expect(a.url).not.toBe(b.url);
    expect(String(a.logId)).not.toBe(String(b.logId));
    expect(await DownloadLog.countDocuments({})).toBe(2);
  });

  test.each(['PENDING', 'REJECTED', 'WITHDRAWN'])('طلب %s: APPLICATION_NOT_ACCEPTED وبلا سجل', async (status) => {
    const s = await setup({}, { status });
    const error = await errorOf(createDownloadLink({ ...baseArgs(s), materialId: s.campaign.materials[0]._id }));
    expect(error.code).toBe('APPLICATION_NOT_ACCEPTED');
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });

  test('طلب مبدع آخر: NOT_FOUND وبلا سجل', async () => {
    const s = await setup();
    const other = await f.createUser();
    const error = await errorOf(
      createDownloadLink({ ...baseArgs(s), creatorId: other._id, materialId: s.campaign.materials[0]._id })
    );
    expect(error.code).toBe('NOT_FOUND');
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });

  test('مادة غير موجودة أو من حملة أخرى: NOT_FOUND وبلا سجل', async () => {
    const s = await setup();
    const unknown = await errorOf(createDownloadLink({ ...baseArgs(s), materialId: '66f1a2b3c4d5e6f708192a99' }));
    expect(unknown.code).toBe('NOT_FOUND');
    expect(unknown.message).toBe('Material not found');

    const foreign = await setup();
    const fromOtherCampaign = await errorOf(
      createDownloadLink({ ...baseArgs(s), materialId: foreign.campaign.materials[0]._id })
    );
    expect(fromOtherCampaign.code).toBe('NOT_FOUND');
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });

  test.each([
    ['ملغاة', { status: 'CANCELLED' }],
    ['موقوفة بسبب بلاغ', { isSuspended: true }],
    ['مؤرشفة', { isArchived: true }],
  ])('حملة %s: CAMPAIGN_UNAVAILABLE وبلا سجل', async (_label, overrides) => {
    const s = await setup(overrides);
    const error = await errorOf(createDownloadLink({ ...baseArgs(s), materialId: s.campaign.materials[0]._id }));
    expect(error.code).toBe('CAMPAIGN_UNAVAILABLE');
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });
});

describe('createDownloadAllLinks', () => {
  test('رابط وسجل لكل مادة بالترتيب، والمجموع صحيح', async () => {
    const s = await setup();
    const result = await createDownloadAllLinks(baseArgs(s));

    expect(result.strategy).toBe('FILES');
    expect(result.totalSizeKb).toBe(6000);
    expect(result.items.map((i) => i.fileName)).toEqual(['file1.mp4', 'file2.mp4', 'file3.mp4']);
    expect(new Set(result.items.map((i) => i.url)).size).toBe(3);

    expect(await DownloadLog.countDocuments({})).toBe(3);
    for (const item of result.items) {
      const log = await DownloadLog.findById(item.logId);
      expect(String(log.materialId)).toBe(String(item.materialId));
      expect(log.status).toBe('REQUESTED');
      expect(verifyDownloadToken(item.url.split('/').pop()).logId).toBe(String(item.logId));
    }
    expect(JSON.stringify(result).includes('fileUrl')).toBe(false);
  });

  test('حملة بلا مواد: قائمة فارغة وبلا سجلات', async () => {
    const s = await setup({ materials: [] });
    expect(await createDownloadAllLinks(baseArgs(s))).toEqual({ strategy: 'FILES', totalSizeKb: 0, items: [] });
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });

  test('أخطاء الصلاحية نفسها: غير مقبول وحملة ملغاة', async () => {
    const pending = await setup({}, { status: 'PENDING' });
    expect((await errorOf(createDownloadAllLinks(baseArgs(pending)))).code).toBe('APPLICATION_NOT_ACCEPTED');

    const cancelled = await setup({ status: 'CANCELLED' });
    expect((await errorOf(createDownloadAllLinks(baseArgs(cancelled)))).code).toBe('CAMPAIGN_UNAVAILABLE');
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });

  test('خطأ إعداد السر لا يترك سجلات يتيمة', async () => {
    const s = await setup();
    delete process.env.DOWNLOAD_LINK_SECRET;
    const error = await errorOf(createDownloadAllLinks(baseArgs(s)));
    expect(error.message).toBe('DOWNLOAD_LINK_SECRET is not configured');
    expect(await DownloadLog.countDocuments({})).toBe(0);
  });
});

describe('material.validator', () => {
  const run = (schema, params) => {
    const req = { params };
    const out = { status: null, json: null, nexted: false };
    const res = {
      status(code) {
        out.status = code;
        return this;
      },
      json(payload) {
        out.json = payload;
        return this;
      },
    };
    validate({ params: schema })(req, res, () => {
      out.nexted = true;
    });
    return { req, ...out };
  };

  const ID = '66f1a2b3c4d5e6f708192a3b';

  test('معرّفات صالحة تمر', () => {
    expect(run(downloadLinkParamsSchema, { id: ID, materialId: ID }).nexted).toBe(true);
    expect(run(downloadAllParamsSchema, { id: ID }).nexted).toBe(true);
  });

  test.each([
    ['id غير صالح', downloadLinkParamsSchema, { id: 'abc', materialId: ID }, 'Application id is invalid'],
    ['materialId غير صالح', downloadLinkParamsSchema, { id: ID, materialId: 'xyz' }, 'Material id is invalid'],
    ['materialId مفقود', downloadLinkParamsSchema, { id: ID }, 'Material id is required'],
    ['id غير صالح في download-all', downloadAllParamsSchema, { id: '123' }, 'Application id is invalid'],
  ])('%s: 400', (_label, schema, params, message) => {
    const r = run(schema, params);
    expect(r.nexted).toBe(false);
    expect(r.status).toBe(400);
    expect(r.json.code).toBe('VALIDATION_ERROR');
    expect(r.json.message).toBe(message);
  });
});