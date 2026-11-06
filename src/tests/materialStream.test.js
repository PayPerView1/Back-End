require('dotenv').config();
const { PassThrough, Readable } = require('stream');
const axios = require('axios');
const db = require('./helpers/db');
const f = require('./helpers/factories');
const DownloadLog = require('../models/downloadLog');
const Notification = require('../models/notification');
const CampaignActivityLog = require('../models/CampaignActivityLog');
const { createDownloadLink, redeemDownload } = require('../services/material/materialDownload.service');
const { streamDownload, buildContentDisposition, MAX_BYTES } = require('../services/material/materialStream.service');

jest.mock('axios');
jest.setTimeout(60000);
beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => { await db.clearDatabase(); jest.clearAllMocks(); });
beforeEach(() => {
  process.env.DOWNLOAD_LINK_SECRET = 'download-secret-for-tests';
  process.env.BACKEND_URL = 'https://api.example.com';
});

const makeRes = () => {
  const res = new PassThrough();
  res.headers = {};
  res.chunks = [];
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.on('data', (c) => res.chunks.push(c));
  return res;
};

const prepare = async () => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, {
    materials: [{
      fileName: 'مقدمة.mp4', fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/x/a.mp4',
      fileType: 'VIDEO', fileSizeKb: 1, mimeType: 'video/mp4', uploadedBy: brand._id,
      publicId: 'x/a', resourceType: 'video',
    }],
  });
  const application = await f.createAcceptedApplication(creator, campaign);
  const item = await createDownloadLink({
    applicationId: application._id, materialId: campaign.materials[0]._id, creatorId: creator._id,
  });
  const prepared = await redeemDownload({ token: item.url.split('/').pop(), creatorId: creator._id });
  return { prepared, campaign, creator, application, logId: item.logId, materialId: campaign.materials[0]._id };
};
const errorOf = async (p) => { try { await p; return null; } catch (e) { return e; } };

test('نجاح: يبث الجسم بالترويسات الصحيحة ويسجل النشاط مرة واحدة', async () => {
  const s = await prepare();
  axios.get.mockResolvedValue({ data: Readable.from([Buffer.from('hello')]), headers: { 'content-length': '5' } });
  const res = makeRes();

  const out = await streamDownload({ prepared: s.prepared, res });
  expect(out.failed).toBe(false);
  expect(Buffer.concat(res.chunks).toString()).toBe('hello');
  expect(res.headers['content-type']).toBe('video/mp4');
  expect(res.headers['content-disposition']).toMatch(/^attachment; filename=".*"; filename\*=UTF-8''/);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect((await DownloadLog.findById(s.logId)).status).toBe('STARTED');

  // تنزيل ثانٍ لنفس المبدع/الحملة لا يضيف سجل نشاط جديداً
  const item2 = await createDownloadLink({
    applicationId: s.application._id, materialId: s.materialId, creatorId: s.creator._id,
  });
  const prepared2 = await redeemDownload({ token: item2.url.split('/').pop(), creatorId: s.creator._id });
  axios.get.mockResolvedValue({ data: Readable.from([Buffer.from('x')]), headers: {} });
  await streamDownload({ prepared: prepared2, res: makeRes() });
  await new Promise((r) => setTimeout(r, 50)); // السجل يُكتب بلا await
  expect(await CampaignActivityLog.countDocuments({ campaignId: s.campaign._id, action: 'MATERIALS_DOWNLOADED' })).toBe(1);
});

test('فشل الاتصال بالمصدر: DOWNLOAD_SOURCE_UNAVAILABLE و FAILED UPSTREAM_ERROR', async () => {
  const s = await prepare();
  axios.get.mockRejectedValue(new Error('boom'));
  const error = await errorOf(streamDownload({ prepared: s.prepared, res: makeRes() }));
  expect(error.code).toBe('DOWNLOAD_SOURCE_UNAVAILABLE');
  const log = await DownloadLog.findById(s.logId);
  expect(log.status).toBe('FAILED');
  expect(log.failureReason).toBe('UPSTREAM_ERROR');

  // إشعار المبدع بفشل من جهة السيرفر (DOWNLOAD_FAILED) مرة واحدة
  const notes = await Notification.find({ userId: s.creator._id, type: 'DOWNLOAD_FAILED' });
  expect(notes).toHaveLength(1);
  expect(String(notes[0].data.logId)).toBe(String(s.logId));
});

test('Content-Length أكبر من الحد: TOO_LARGE قبل أي بث', async () => {
  const s = await prepare();
  axios.get.mockResolvedValue({ data: Readable.from([]), headers: { 'content-length': String(MAX_BYTES + 1) } });
  const res = makeRes();
  expect((await errorOf(streamDownload({ prepared: s.prepared, res }))).code).toBe('DOWNLOAD_SOURCE_UNAVAILABLE');
  expect(res.chunks).toHaveLength(0);
  expect((await DownloadLog.findById(s.logId)).failureReason).toBe('TOO_LARGE');
});

test('تجاوز الحد أثناء البث بلا Content-Length: يُقطع و FAILED TOO_LARGE', async () => {
  const s = await prepare();
  const big = Buffer.alloc(MAX_BYTES + 1);
  axios.get.mockResolvedValue({ data: Readable.from([big]), headers: {} });
  const out = await streamDownload({ prepared: s.prepared, res: makeRes() });
  expect(out.failed).toBe(true);
  expect((await DownloadLog.findById(s.logId)).failureReason).toBe('TOO_LARGE');
});

test('المبدع يقطع الاتصال: FAILED CLIENT_ABORTED', async () => {
  const s = await prepare();
  const upstream = new PassThrough();
  axios.get.mockResolvedValue({ data: upstream, headers: {} });
  const res = makeRes();

  const pending = streamDownload({ prepared: s.prepared, res });
  upstream.write(Buffer.from('part'));
  setTimeout(() => res.destroy(), 20);
  const out = await pending;
  expect(out.failed).toBe(true);
  expect((await DownloadLog.findById(s.logId)).failureReason).toBe('CLIENT_ABORTED');

  // قطع المبدع بنفسه لا يُنشئ إشعار فشل
  expect(await Notification.countDocuments({ userId: s.creator._id, type: 'DOWNLOAD_FAILED' })).toBe(0);
});

test('buildContentDisposition: لا حقن ترويسات ولا أحرف غير ASCII في filename', () => {
  const h = buildContentDisposition('مقدمة"\r\nX: y.mp4');
  expect(h).not.toMatch(/[\r\n]/);
  expect(h.split('filename*')[0]).toMatch(/^[\x20-\x7E]+$/);
});