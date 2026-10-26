// يحتاج قاعدة بيانات (db.js). يُحاكى فقط جلب بيانات المنشور (الشبكة).
jest.mock('../services/social/socialMetadata.service', () => ({ fetchPostMetadata: jest.fn() }));

const db = require('./helpers/db');
const f = require('./helpers/factories');
const { fetchPostMetadata } = require('../services/social/socialMetadata.service');
const { verifyPost } = require('../services/submission/submissionVerify.service');

jest.setTimeout(120000);
beforeAll(db.connect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});
afterAll(db.disconnect);

const URL_1 = 'https://www.tiktok.com/@mizaninvest/video/7391234567890123456';

const okMeta = (caption = '#وافي_الاستثمار #تمويل_إسلامي @WafiFinance') => ({
  fetchStatus: 'OK',
  caption,
  durationSec: 42,
});

const setup = async (campaignOverrides = {}) => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, campaignOverrides);
  const application = await f.createAcceptedApplication(creator, campaign);
  return { brand, creator, campaign, application };
};

const run = (s, extra = {}) =>
  verifyPost({ creatorId: s.creator._id, campaignId: s.campaign._id, platform: 'TIKTOK', url: URL_1, ...extra });

const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

describe('verifyPost', () => {
  test('نجاح: يرجع الحملة والطلب والرابط المطبَّع والتقييم', async () => {
    const s = await setup({
      submissionRequirements: { requiredHashtags: ['تمويل_إسلامي', 'وافي_الاستثمار'], requiredMentions: ['WafiFinance'] },
    });
    fetchPostMetadata.mockResolvedValue(okMeta());

    const r = await run(s);
    expect(String(r.campaign._id)).toBe(String(s.campaign._id));
    expect(String(r.application._id)).toBe(String(s.application._id));
    expect(r.parsed.externalId).toBe('7391234567890123456');
    expect(r.evaluation.canSubmit).toBe(true);
    expect(r.evaluation.allMet).toBe(true);
  });

  test('هاشتاق ناقص: لا يرمي، يرجع canSubmit=false', async () => {
    const s = await setup({ submissionRequirements: { requiredHashtags: ['تمويل_إسلامي'] } });
    fetchPostMetadata.mockResolvedValue(okMeta('#other'));

    const r = await run(s);
    expect(r.evaluation.canSubmit).toBe(false);
    expect(r.evaluation.blocking.missingHashtags).toEqual(['#تمويل_إسلامي']);
  });

  test('مبدع غير مقبول (لا طلب، أو طلب PENDING)', async () => {
    const brand = await f.createBrand();
    const creator = await f.createUser();
    const campaign = await f.createCampaign(brand);
    const s = { creator, campaign };

    expect((await errorOf(run(s))).code).toBe('APPLICATION_NOT_ACCEPTED');

    await f.createAcceptedApplication(creator, campaign, { status: 'PENDING' });
    expect((await errorOf(run(s))).code).toBe('APPLICATION_NOT_ACCEPTED');
  });

  test('حملة غير موجودة أو مغلقة', async () => {
    const s = await setup({ status: 'CANCELLED' });
    expect((await errorOf(run(s))).code).toBe('CAMPAIGN_UNAVAILABLE');
  });

  test('بلوغ حد التسليمات، ويتجاوزه skipLimitCheck', async () => {
    const s = await setup({ maxSubmissionsPerCreator: 1 });
    await f.createSubmission(s);
    fetchPostMetadata.mockResolvedValue(okMeta());

    const error = await errorOf(run(s));
    expect(error.code).toBe('SUBMISSION_LIMIT_REACHED');
    expect(error.details).toEqual({ active: 1, limit: 1 });

    await run(s, { skipLimitCheck: true }); // لا يرمي
  });

  test('منصة لا تقبلها الحملة', async () => {
    const s = await setup({ submissionRequirements: { platforms: ['YOUTUBE'] } });
    const error = await errorOf(run(s));
    expect(error.code).toBe('UNSUPPORTED_PLATFORM');
    expect(error.details.allowed).toEqual(['YOUTUBE']);
  });

  test('رابط غير صالح ومنصة لا تطابق', async () => {
    const s = await setup();
    expect((await errorOf(run(s, { url: 'https://www.facebook.com/watch/?v=1' }))).code).toBe('UNSUPPORTED_PLATFORM');
    expect((await errorOf(run(s, { url: 'https://www.youtube.com/shorts/abcDEF12345' }))).code).toBe('PLATFORM_MISMATCH');
  });

  test('المنشور غير موجود (404) أو خاص', async () => {
    const s = await setup();
    fetchPostMetadata.mockResolvedValue({ fetchStatus: 'NOT_FOUND' });
    const notFound = await errorOf(run(s));
    expect(notFound.code).toBe('INVALID_LINK');
    expect(notFound.details.httpStatus).toBe(404);

    fetchPostMetadata.mockResolvedValue({ fetchStatus: 'PRIVATE' });
    expect((await errorOf(run(s))).code).toBe('POST_NOT_PUBLIC');
  });

  test('المنشور غير قابل للقراءة: يتابع بدون حجب', async () => {
    const s = await setup({ submissionRequirements: { requiredHashtags: ['x'] } });
    fetchPostMetadata.mockResolvedValue({ fetchStatus: 'UNAVAILABLE' });
    const r = await run(s);
    expect(r.evaluation.canSubmit).toBe(true);
    expect(r.evaluation.warnings).toEqual(['CONTENT_NOT_VERIFIABLE']);
  });

  test('تكرار من نفس المبدع: يرجع التفاصيل. ومن مبدع آخر: بدون تفاصيل', async () => {
    const s = await setup();
    fetchPostMetadata.mockResolvedValue(okMeta());
    const mine = await f.createSubmission(s, {
      postUrl: URL_1,
      canonicalUrl: URL_1,
      externalId: '7391234567890123456',
    });

    const own = await errorOf(run(s));
    expect(own.code).toBe('LINK_ALREADY_SUBMITTED');
    expect(String(own.details.submissionId)).toBe(String(mine._id));
    expect(own.details.campaignName).toBe(s.campaign.name);

    const other = await f.createUser();
    await f.createAcceptedApplication(other, s.campaign);
    const foreign = await errorOf(verifyPost({ creatorId: other._id, campaignId: s.campaign._id, platform: 'TIKTOK', url: URL_1 }));
    expect(foreign.code).toBe('LINK_ALREADY_SUBMITTED');
    expect(foreign.details).toBeNull();
  });

  test('excludeSubmissionId: لا يعدّ تحديث الرابط تكراراً لنفسه', async () => {
    const s = await setup();
    fetchPostMetadata.mockResolvedValue(okMeta());
    const mine = await f.createSubmission(s, {
      postUrl: URL_1,
      canonicalUrl: URL_1,
      externalId: '7391234567890123456',
    });

    await run(s, { excludeSubmissionId: mine._id }); // لا يرمي
  });

  test('تسليم مسحوب يحرّر الرابط', async () => {
    const s = await setup();
    fetchPostMetadata.mockResolvedValue(okMeta());
    await f.createSubmission(s, {
      postUrl: URL_1,
      canonicalUrl: URL_1,
      externalId: '7391234567890123456',
      status: 'WITHDRAWN',
    });

    await run(s); // لا يرمي
  });
});