require('dotenv').config();
const db = require('./helpers/db');
const f = require('./helpers/factories');
const DownloadLog = require('../models/downloadLog');
const { createDownloadLink, redeemDownload } = require('../services/material/materialDownload.service');
const { reportDownloadResult, getCampaignDownloads } = require('../services/material/materialDownloadLog.service');
const { notifyDownloadResult } = require('../services/submission/submissionNotifications.service');

jest.mock('../services/submission/submissionNotifications.service', () => ({
  notifyDownloadResult: jest.fn().mockResolvedValue(null),
}));

jest.setTimeout(10000);
beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => { await db.clearDatabase(); jest.clearAllMocks(); });
beforeEach(() => {
  process.env.DOWNLOAD_LINK_SECRET = 'download-secret-for-tests';
  process.env.BACKEND_URL = 'https://api.example.com';
});

const URL = 'https://res.cloudinary.com/demo/video/upload/v1/x/intro.mp4';
const material = (brand) => ({
  fileName: 'intro.mp4', fileUrl: URL, fileType: 'VIDEO', fileSizeKb: 8200, mimeType: 'video/mp4',
  uploadedBy: brand._id, publicId: 'x/intro', resourceType: 'video',
});

const setup = async () => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, { materials: [material(brand)] });
  const application = await f.createAcceptedApplication(creator, campaign);
  return { brand, creator, campaign, application, materialId: campaign.materials[0]._id };
};

const issue = async (s, creator = s.creator, application = s.application) => {
  const item = await createDownloadLink({
    applicationId: application._id, materialId: s.materialId, creatorId: creator._id,
  });
  return { token: item.url.split('/').pop(), logId: item.logId, creator };
};
const consume = async ({ token, creator }) => redeemDownload({ token, creatorId: creator._id });
const errorOf = async (p) => { try { await p; return null; } catch (e) { return e; } };

describe('reportDownloadResult (A5.6)', () => {
  test('COMPLETED بعد الاستهلاك: ينجح ويُرسل إشعاراً', async () => {
    const s = await setup();
    const l = await issue(s);
    await consume(l);

    const res = await reportDownloadResult(l.logId, s.creator._id, { status: 'COMPLETED' });
    expect(res).toEqual({ id: l.logId, status: 'COMPLETED' });
    const log = await DownloadLog.findById(l.logId);
    expect(log.completedAt instanceof Date).toBe(true);
    expect(notifyDownloadResult).toHaveBeenCalledTimes(1);
    expect(notifyDownloadResult.mock.calls[0][2]).toBe('COMPLETED');
  });

  test('الإبلاغ مرتين: CONFLICT بلا إشعار ثانٍ', async () => {
    const s = await setup();
    const l = await issue(s);
    await consume(l);
    await reportDownloadResult(l.logId, s.creator._id, { status: 'COMPLETED' });

    expect((await errorOf(reportDownloadResult(l.logId, s.creator._id, { status: 'FAILED' }))).code).toBe('CONFLICT');
    expect(notifyDownloadResult).toHaveBeenCalledTimes(1);
  });

  test('COMPLETED على رابط لم يُستهلك: CONFLICT', async () => {
    const s = await setup();
    const l = await issue(s);
    expect((await errorOf(reportDownloadResult(l.logId, s.creator._id, { status: 'COMPLETED' }))).code).toBe('CONFLICT');
  });

  test('FAILED على رابط لم يُستهلك: ينجح ويحفظ السبب', async () => {
    const s = await setup();
    const l = await issue(s);
    await reportDownloadResult(l.logId, s.creator._id, { status: 'FAILED', reason: 'network down' });
    const log = await DownloadLog.findById(l.logId);
    expect(log.status).toBe('FAILED');
    expect(log.failureReason).toBe('network down');
  });

  test('فشل سجّله السيرفر: CONFLICT', async () => {
    const s = await setup();
    const l = await issue(s);
    await consume(l);
    await DownloadLog.updateOne({ _id: l.logId }, { $set: { status: 'FAILED', failureReason: 'UPSTREAM_ERROR' } });
    expect((await errorOf(reportDownloadResult(l.logId, s.creator._id, { status: 'FAILED' }))).code).toBe('CONFLICT');
  });

  test('سجل مبدع آخر: NOT_FOUND ولا يتغير', async () => {
    const s = await setup();
    const l = await issue(s);
    await consume(l);
    const other = await f.createUser();
    expect((await errorOf(reportDownloadResult(l.logId, other._id, { status: 'COMPLETED' }))).code).toBe('NOT_FOUND');
    expect((await DownloadLog.findById(l.logId)).status).toBe('STARTED');
  });
});

describe('getCampaignDownloads (A5.7)', () => {
  test('يجمع حسب المبدع ويستثني غير المستهلك والفاشل', async () => {
    const s = await setup();
    const creator2 = await f.createUser();
    const app2 = await f.createAcceptedApplication(creator2, s.campaign);

    await consume(await issue(s));                       // مبدع 1: تنزيلان
    await consume(await issue(s));
    await issue(s);                                      // رابط غير مستهلك: لا يُحتسب
    const failed = await issue(s);
    await consume(failed);
    await DownloadLog.updateOne({ _id: failed.logId }, { $set: { status: 'FAILED' } }); // لا يُحتسب
    await consume(await issue(s, creator2, app2));       // مبدع 2: تنزيل واحد

    const { data, pagination } = await getCampaignDownloads(s.campaign._id, {});
    expect(pagination.total).toBe(2);
    const mine = data.find((d) => String(d.creator.id) === String(s.creator._id));
    const theirs = data.find((d) => String(d.creator.id) === String(creator2._id));
    expect(mine.totalDownloads).toBe(2);
    expect(theirs.totalDownloads).toBe(1);
    expect(Object.keys(mine.creator).sort()).toEqual(['fullName', 'id', 'profilePicture']);
  });

  test('الترقيم، وحملة بلا تنزيلات', async () => {
    const s = await setup();
    expect((await getCampaignDownloads(s.campaign._id, {})).data).toEqual([]);

    const creator2 = await f.createUser();
    const app2 = await f.createAcceptedApplication(creator2, s.campaign);
    await consume(await issue(s));
    await consume(await issue(s, creator2, app2));

    const page1 = await getCampaignDownloads(s.campaign._id, { page: 1, perPage: 1 });
    expect(page1.data).toHaveLength(1);
    expect(page1.pagination).toEqual({ page: 1, perPage: 1, total: 2, totalPages: 2 });
  });
});