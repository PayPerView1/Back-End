// src/tests/submissionLifecycle.test.js
// المالك: المسار ب — اختبارات دورة التسليم B1/B2/B4 (submission.service.js).
// المرجع: API_CONTRACT_SPRINT5.md §5
//
// نضرب verifyPost (شبكة/منصات) و side-effects (الإشعار + معالجة AI) بـ mocks،
// ونبقي قاعدة البيانات حقيقية لاختبار الفهارس الفريدة وحد التسليمات.
require('dotenv').config();

const db = require('./helpers/db');
const f = require('./helpers/factories');
const Submission = require('../models/submission');
const SubmissionDraft = require('../models/submissionDraft');
const { SUBMISSION_STATUS, ADVERTISER_STATUS } = require('../constants/submission.constants');
const { AI_REVIEW_RESULT } = require('../constants/campaign.constants');

jest.mock('../services/submission/submissionVerify.service', () => ({
  verifyPost: jest.fn(),
}));
jest.mock('../services/submission/submissionNotifications.service', () => ({
  notifyBrandNewSubmission: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/submission/submissionProcessing.service', () => ({
  processSubmission: jest.fn().mockResolvedValue({ processed: true }),
}));

const { verifyPost } = require('../services/submission/submissionVerify.service');
const { notifyBrandNewSubmission } = require('../services/submission/submissionNotifications.service');
const { processSubmission } = require('../services/submission/submissionProcessing.service');
const {
  createSubmission,
  getMySubmissions,
  getSubmissionById,
  withdrawSubmission,
  updateSubmissionLink,
  resubmitSubmission,
} = require('../services/submission/submission.service');

jest.setTimeout(120000);

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});

// ============================================
// Helpers
// ============================================
const flush = () => new Promise((resolve) => setImmediate(resolve));

const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

const setup = async (campaignOverrides = {}, applicationOverrides = {}) => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, campaignOverrides);
  const application = await f.createAcceptedApplication(creator, campaign, applicationOverrides);
  return { brand, creator, campaign, application };
};

/** نتيجة verifyPost ناجحة (كل الفحوصات تمر) */
const okVerify = (campaign, application, overrides = {}) => ({
  campaign,
  application,
  parsed: {
    platform: 'TIKTOK',
    canonicalUrl: 'https://www.tiktok.com/@user/video/111',
    externalId: 'ext-111',
  },
  postMeta: {
    fetchStatus: 'OK',
    caption: 'clip #halal',
    authorName: 'User',
    authorHandle: '@user',
    authorUrl: '',
    thumbnailUrl: '',
    durationSec: 30,
    publishedAt: null,
    stats: null,
    fetchedAt: new Date(),
  },
  evaluation: {
    canSubmit: true,
    checks: [{ code: 'REQUIRED_HASHTAGS', source: 'RULES', status: 'PASSED' }],
    blocking: {},
  },
  ...overrides,
});

const createBody = (overrides = {}) => ({
  platform: 'TIKTOK',
  url: 'https://www.tiktok.com/@user/video/111',
  hashtags: ['#halal'],
  keywords: [],
  notes: '',
  halalPledge: true,
  ...overrides,
});

// ============================================
// B1 — createSubmission
// ============================================
describe('createSubmission (B1)', () => {
  test('ينشئ التسليم بحالة SUBMITTED ويعيد SubmissionDetail بـ PROCESSING', async () => {
    const { creator, campaign, application } = await setup();
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    const data = await createSubmission(creator._id, campaign._id, createBody());

    expect(data.status).toBe(SUBMISSION_STATUS.SUBMITTED);
    expect(data.displayStatus).toBe('PROCESSING');
    expect(String(data.campaign.id)).toBe(String(campaign._id));
    expect(data.attempt).toBe(1);
    expect(data.reviewDeadlineAt).toBeInstanceOf(Date);

    const saved = await Submission.findById(data.id);
    expect(String(saved.creatorId)).toBe(String(creator._id));
    expect(String(saved.applicationId)).toBe(String(application._id));
    expect(saved.linkLocked).toBe(true);
    expect(saved.halalPledge.accepted).toBe(true);
    expect(saved.halalPledge.acceptedAt).toBeInstanceOf(Date);
    expect(saved.dedupKey).toBe('TIKTOK:ext-111');
    // الهاشتاق مأخوذ من الوصف أيضًا (بدون # ومكرر مرة واحدة)
    expect(saved.hashtags).toEqual(['halal']);
  });

  test('يحذف مسودة الحملة بعد نجاح الإنشاء', async () => {
    const { creator, campaign, application } = await setup();
    verifyPost.mockResolvedValue(okVerify(campaign, application));
    await SubmissionDraft.create({ creatorId: creator._id, campaignId: campaign._id, postUrl: 'x' });

    await createSubmission(creator._id, campaign._id, createBody());

    expect(await SubmissionDraft.countDocuments({ creatorId: creator._id, campaignId: campaign._id })).toBe(0);
  });

  test('يشغّل معالجة الـ AI خارج مسار الاستجابة (setImmediate)', async () => {
    const { creator, campaign, application } = await setup();
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    const data = await createSubmission(creator._id, campaign._id, createBody());
    await flush();

    expect(processSubmission).toHaveBeenCalledTimes(1);
    expect(String(processSubmission.mock.calls[0][0])).toBe(String(data.id));
  });

  test('لا يرسل NEW_SUBMISSION عند الإنشاء (يُرسل عند مرحلة المعلن فقط)', async () => {
    const { creator, campaign, application } = await setup();
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    await createSubmission(creator._id, campaign._id, createBody());
    await flush();

    expect(notifyBrandNewSubmission).not.toHaveBeenCalled();
  });

  test('يرفض الرابط المكرر بـ LINK_ALREADY_SUBMITTED (فهرس dedupKey)', async () => {
    const { creator, campaign, application } = await setup();
    await f.createSubmission(
      { creator, campaign, application },
      { platform: 'TIKTOK', externalId: 'ext-111', status: SUBMISSION_STATUS.SUBMITTED }
    );
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    const error = await errorOf(createSubmission(creator._id, campaign._id, createBody()));

    expect(error).not.toBeNull();
    expect(error.code).toBe('LINK_ALREADY_SUBMITTED');
    expect(await Submission.countDocuments({ creatorId: creator._id })).toBe(1);
  });

  test('يمنع تجاوز حد التسليمات بعد الإنشاء (سباق) ويرجع SUBMISSION_LIMIT_REACHED', async () => {
    const { creator, campaign, application } = await setup({ maxSubmissionsPerCreator: 1 });
    await f.createSubmission({ creator, campaign, application }, { externalId: 'existing-1' });
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    const error = await errorOf(createSubmission(creator._id, campaign._id, createBody()));

    expect(error).not.toBeNull();
    expect(error.code).toBe('SUBMISSION_LIMIT_REACHED');
    expect(await Submission.countDocuments({ creatorId: creator._id })).toBe(1);
  });

  test('يرفض المحتوى غير المطابق بـ CONTENT_REQUIREMENTS_NOT_MET + details', async () => {
    const { creator, campaign, application } = await setup();
    const blocking = { missingHashtags: ['#wafi'], missingKeywords: [], missingMentions: [], duration: null };
    verifyPost.mockResolvedValue(
      okVerify(campaign, application, { evaluation: { canSubmit: false, checks: [], blocking } })
    );

    const error = await errorOf(createSubmission(creator._id, campaign._id, createBody()));

    expect(error).not.toBeNull();
    expect(error.code).toBe('CONTENT_REQUIREMENTS_NOT_MET');
    expect(error.details).toEqual(blocking);
    expect(await Submission.countDocuments({})).toBe(0);
  });
});

// ============================================
// B2 — getMySubmissions / getSubmissionById
// ============================================
describe('getMySubmissions / getSubmissionById (B2)', () => {
  test('يستثني WITHDRAWN افتراضيًا', async () => {
    const { creator, campaign, application } = await setup();
    const active = await f.createSubmission({ creator, campaign, application });
    await f.createSubmission(
      { creator, campaign, application },
      { status: SUBMISSION_STATUS.WITHDRAWN, externalId: 'withdrawn-1' }
    );

    const { data, pagination } = await getMySubmissions(creator._id);

    expect(data).toHaveLength(1);
    expect(String(data[0].id)).toBe(String(active._id));
    expect(pagination.total).toBe(1);
  });

  test('يفلتر حسب displayStatus وcampaignId', async () => {
    const { creator, campaign, application } = await setup();
    const rejected = await f.createSubmission(
      { creator, campaign, application },
      { status: SUBMISSION_STATUS.REJECTED, rejectedBy: 'AI', externalId: 'ai-rej-1' }
    );
    await f.createSubmission(
      { creator, campaign, application },
      { status: SUBMISSION_STATUS.APPROVED, externalId: 'approved-1' }
    );

    const { data } = await getMySubmissions(creator._id, {
      displayStatus: 'AI_REJECTED',
      campaignId: String(campaign._id),
    });

    expect(data).toHaveLength(1);
    expect(String(data[0].id)).toBe(String(rejected._id));
    expect(data[0].displayStatus).toBe('AI_REJECTED');
  });

  test('AWAITING_ADVERTISER لا يشمل المراجعة اليدوية، وMANUAL_REVIEW منفصل', async () => {
    const { creator, campaign, application } = await setup();
    const awaiting = await f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        aiReview: { status: AI_REVIEW_RESULT.APPROVED, score: 90 },
        advertiserReview: { status: ADVERTISER_STATUS.PENDING },
      }
    );
    const manual = await f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        aiReview: { status: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED },
        advertiserReview: { status: ADVERTISER_STATUS.PENDING },
        adminReview: { reasonCode: 'AUDIO_UNCERTAIN', queuedAt: new Date() },
      }
    );

    const awaitingList = await getMySubmissions(creator._id, {
      displayStatus: 'AWAITING_ADVERTISER',
    });
    const manualList = await getMySubmissions(creator._id, { displayStatus: 'MANUAL_REVIEW' });

    expect(awaitingList.data.map((s) => String(s.id))).toEqual([String(awaiting._id)]);
    expect(manualList.data.map((s) => String(s.id))).toEqual([String(manual._id)]);
  });

  test('يعيد 404 لتسليم مبدع آخر', async () => {
    const { campaign, application } = await setup();
    const other = await f.createUser();
    const submission = await f.createSubmission({ creator: other, campaign, application });

    const error = await errorOf(getSubmissionById(submission._id, (await f.createUser())._id));

    expect(error).not.toBeNull();
    expect(error.code).toBe('NOT_FOUND');
  });

  test('يعيد SubmissionDetail لصاحبه', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission({ creator, campaign, application });

    const data = await getSubmissionById(submission._id, creator._id);

    expect(String(data.id)).toBe(String(submission._id));
    expect(data.campaign.name).toBe(campaign.name);
    expect(data.displayStatus).toBe('PROCESSING');
  });
});

// ============================================
// B4 — withdrawSubmission
// ============================================
describe('withdrawSubmission (B4)', () => {
  test('يسحب PROCESSING ويحرر الرابط', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission({ creator, campaign, application });

    const result = await withdrawSubmission(submission._id, creator._id);

    expect(result.status).toBe(SUBMISSION_STATUS.WITHDRAWN);
    const saved = await Submission.findById(submission._id);
    expect(saved.linkLocked).toBe(false);
    expect(saved.withdrawnAt).toBeInstanceOf(Date);
  });

  test('يسحب AWAITING_ADVERTISER قبل قرار المعلن', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        aiReview: { status: AI_REVIEW_RESULT.APPROVED, score: 90 },
        advertiserReview: { status: ADVERTISER_STATUS.PENDING },
      }
    );

    const result = await withdrawSubmission(submission._id, creator._id);

    expect(result.status).toBe(SUBMISSION_STATUS.WITHDRAWN);
  });

  test('يسحب MANUAL_REVIEW (المعلن لم يقرر بعد — canWithdraw)', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        aiReview: { status: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED },
        advertiserReview: { status: ADVERTISER_STATUS.PENDING },
        adminReview: { reasonCode: 'AUDIO_UNCERTAIN', queuedAt: new Date() },
      }
    );

    const result = await withdrawSubmission(submission._id, creator._id);

    expect(result.status).toBe(SUBMISSION_STATUS.WITHDRAWN);
    const saved = await Submission.findById(submission._id);
    expect(saved.linkLocked).toBe(false);
    expect(saved.withdrawnAt).toBeInstanceOf(Date);
  });

  test('يرفض سحب APPROVED بـ SUBMISSION_NOT_WITHDRAWABLE', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission(
      { creator, campaign, application },
      { status: SUBMISSION_STATUS.APPROVED }
    );

    const error = await errorOf(withdrawSubmission(submission._id, creator._id));

    expect(error).not.toBeNull();
    expect(error.code).toBe('SUBMISSION_NOT_WITHDRAWABLE');
  });

  test('يعيد 404 لتسليم مبدع آخر', async () => {
    const { campaign, application } = await setup();
    const other = await f.createUser();
    const submission = await f.createSubmission({ creator: other, campaign, application });

    const error = await errorOf(withdrawSubmission(submission._id, (await f.createUser())._id));

    expect(error).not.toBeNull();
    expect(error.code).toBe('NOT_FOUND');
  });
});

// ============================================
// B4 — updateSubmissionLink
// ============================================
describe('updateSubmissionLink (B4)', () => {
  const awaitingSubmission = (creator, campaign, application, overrides = {}) =>
    f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        aiReview: { status: AI_REVIEW_RESULT.APPROVED, score: 90 },
        advertiserReview: { status: ADVERTISER_STATUS.PENDING },
        reviewDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ...overrides,
      }
    );

  test('يحدّث الرابط ويعيد الحالة SUBMITTED ويضيف linkHistory', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await awaitingSubmission(creator, campaign, application);
    const oldUrl = submission.postUrl;
    verifyPost.mockResolvedValue(
      okVerify(campaign, application, {
        parsed: {
          platform: 'TIKTOK',
          canonicalUrl: 'https://www.tiktok.com/@user/video/222',
          externalId: 'ext-222',
        },
      })
    );

    const data = await updateSubmissionLink(submission._id, creator._id, {
      url: 'https://www.tiktok.com/@user/video/222',
      reason: 'Reposted with a new caption',
    });

    expect(data.status).toBe(SUBMISSION_STATUS.SUBMITTED);
    expect(data.displayStatus).toBe('PROCESSING');

    const saved = await Submission.findById(submission._id);
    expect(saved.postUrl).toBe('https://www.tiktok.com/@user/video/222');
    expect(saved.canonicalUrl).toBe('https://www.tiktok.com/@user/video/222');
    expect(saved.linkHistory).toHaveLength(1);
    expect(saved.linkHistory[0].postUrl).toBe(oldUrl);
    expect(saved.linkHistory[0].reason).toBe('Reposted with a new caption');
    expect(saved.advertiserReview.status).toBe(ADVERTISER_STATUS.PENDING);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.PENDING);
    expect(saved.reviewDeadlineAt.getTime()).toBeGreaterThan(Date.now());

    await flush();
    expect(processSubmission).toHaveBeenCalledTimes(1);
  });

  test('يعيد ضبط قرار الأدمن عند تحديث الرابط', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await awaitingSubmission(creator, campaign, application, {
      adminReview: {
        reasonCode: 'AUDIO_UNCERTAIN',
        queuedAt: new Date(),
        decision: 'APPROVE',
        reviewedAt: new Date(),
      },
    });
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    await updateSubmissionLink(submission._id, creator._id, {
      url: 'https://www.tiktok.com/@user/video/222',
    });

    const saved = await Submission.findById(submission._id);
    expect(saved.adminReview.decision).toBeNull();
    expect(saved.adminReview.reasonCode).toBeNull();
    expect(saved.adminReview.queuedAt).toBeNull();
    expect(saved.adminReview.reviewedAt).toBeNull();
    expect(saved.adminReview.reviewedBy).toBeNull();
    expect(saved.adminReview.note).toBe('');
  });

  test('يرفض التحديث أثناء PROCESSING بـ SUBMISSION_NOT_EDITABLE', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission({ creator, campaign, application });

    const error = await errorOf(
      updateSubmissionLink(submission._id, creator._id, { url: 'https://www.tiktok.com/@user/video/222' })
    );

    expect(error).not.toBeNull();
    expect(error.code).toBe('SUBMISSION_NOT_EDITABLE');
  });

  test('يعيد 404 لتسليم مبدع آخر', async () => {
    const { campaign, application } = await setup();
    const other = await f.createUser();
    const submission = await awaitingSubmission(other, campaign, application);

    const error = await errorOf(
      updateSubmissionLink(submission._id, (await f.createUser())._id, {
        url: 'https://www.tiktok.com/@user/video/222',
      })
    );

    expect(error).not.toBeNull();
    expect(error.code).toBe('NOT_FOUND');
  });
});

// ============================================
// B4 — resubmitSubmission
// ============================================
describe('resubmitSubmission (B4)', () => {
  test('ينشئ محاولة جديدة من AI_REJECTED مع attempt + 1 و resubmissionOf', async () => {
    const { creator, campaign, application } = await setup();
    const original = await f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: 'AI',
        rejectionReasons: [{ code: 'AUDIO_COMPLIANCE', message: 'Background music' }],
      }
    );
    verifyPost.mockResolvedValue(
      okVerify(campaign, application, {
        parsed: {
          platform: 'TIKTOK',
          canonicalUrl: 'https://www.tiktok.com/@user/video/333',
          externalId: 'ext-333',
        },
      })
    );

    const data = await resubmitSubmission(original._id, creator._id, {
      url: 'https://www.tiktok.com/@user/video/333',
    });

    expect(data.status).toBe(SUBMISSION_STATUS.SUBMITTED);
    expect(data.displayStatus).toBe('PROCESSING');
    expect(data.attempt).toBe(2);
    expect(String(data.resubmissionOf)).toBe(String(original._id));

    expect(await Submission.countDocuments({ creatorId: creator._id })).toBe(2);
    const saved = await Submission.findById(data.id);
    expect(String(saved.applicationId)).toBe(String(application._id));
    expect(saved.postUrl).toBe('https://www.tiktok.com/@user/video/333');

    await flush();
    expect(processSubmission).toHaveBeenCalledTimes(1);
  });

  test('ينسخ الحقول المحذوفة من المحاولة السابقة', async () => {
    const { creator, campaign, application } = await setup();
    const original = await f.createSubmission(
      { creator, campaign, application },
      {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: 'ADVERTISER',
        notes: 'ملاحظة قديمة',
        keywords: ['وافي'],
        hashtags: ['halal'],
        advertiserReview: { status: ADVERTISER_STATUS.REJECTED, note: 'عدّل' },
      }
    );
    verifyPost.mockResolvedValue(okVerify(campaign, application));

    const data = await resubmitSubmission(original._id, creator._id, {});

    const saved = await Submission.findById(data.id);
    expect(saved.notes).toBe('ملاحظة قديمة');
    expect(saved.keywords).toEqual(['وافي']);
    expect(saved.hashtags).toContain('halal');
  });

  test('يرفض إعادة التسليم من حالة غير مرفوضة بـ SUBMISSION_NOT_EDITABLE', async () => {
    const { creator, campaign, application } = await setup();
    const submission = await f.createSubmission(
      { creator, campaign, application },
      { status: SUBMISSION_STATUS.APPROVED }
    );

    const error = await errorOf(resubmitSubmission(submission._id, creator._id, {}));

    expect(error).not.toBeNull();
    expect(error.code).toBe('SUBMISSION_NOT_EDITABLE');
  });

  test('يعيد 404 لتسليم مبدع آخر', async () => {
    const { campaign, application } = await setup();
    const other = await f.createUser();
    const original = await f.createSubmission(
      { creator: other, campaign, application },
      { status: SUBMISSION_STATUS.REJECTED, rejectedBy: 'AI' }
    );

    const error = await errorOf(resubmitSubmission(original._id, (await f.createUser())._id, {}));

    expect(error).not.toBeNull();
    expect(error.code).toBe('NOT_FOUND');
  });
});
