// src/tests/submissionReview.test.js
// المالك: المسار ب — اختبارات مراجعة التسليمات (B5/B6) والاعتماد التلقائي.
// المرجع: API_CONTRACT_SPRINT5.md §6 + §8
//
// نضرب الإشعارات بـ mocks (لا نريد بريدًا فعليًا)، ونبقي قاعدة البيانات حقيقية
// لاختبار الاستعلامات المركبة (displayStatus → filter) والتحديثات الشرطية.
require('dotenv').config();

const mongoose = require('mongoose');

const db = require('./helpers/db');
const f = require('./helpers/factories');
const Submission = require('../models/submission');
const Campaign = require('../models/campaign');
const {
  SUBMISSION_STATUS,
  ADVERTISER_STATUS,
  REJECTED_BY,
  DISPLAY_STATUS,
  SUBMISSION_CONFIG,
} = require('../constants/submission.constants');
const { AI_REVIEW_RESULT } = require('../constants/campaign.constants');

jest.mock('../services/submission/submissionNotifications.service', () => ({
  notifyCreatorApproved: jest.fn(),
  notifyCreatorRejected: jest.fn(),
  notifyBrandNewSubmission: jest.fn(),
}));

const {
  notifyCreatorApproved,
  notifyCreatorRejected,
  notifyBrandNewSubmission,
} = require('../services/submission/submissionNotifications.service');
const {
  getCampaignSubmissions,
  reviewSubmission,
  getManualReviewQueue,
  decideManualReview,
  autoApproveDueSubmissions,
} = require('../services/submission/submissionReview.service');

jest.setTimeout(120000);

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
  delete process.env.ENABLE_SUBMISSION_AUTO_APPROVE;
});
beforeEach(() => {
  notifyCreatorApproved.mockResolvedValue(null);
  notifyCreatorRejected.mockResolvedValue(null);
  notifyBrandNewSubmission.mockResolvedValue(null);
});

// ============================================
// Helpers
// ============================================
const HOUR = 60 * 60 * 1000;

const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

const setup = async (campaignOverrides = {}) => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, campaignOverrides);
  const application = await f.createAcceptedApplication(creator, campaign);
  return { brand, creator, campaign, application };
};

/** تسليم وصل لمرحلة المعلن (AI وافق) */
const awaitingSubmission = (ctx, overrides = {}) =>
  f.createSubmission(ctx, {
    status: SUBMISSION_STATUS.UNDER_REVIEW,
    aiReview: { status: AI_REVIEW_RESULT.APPROVED, score: 90, reviewedAt: new Date() },
    advertiserReview: { status: ADVERTISER_STATUS.PENDING },
    reviewDeadlineAt: new Date(Date.now() + 12 * HOUR),
    ...overrides,
  });

/** تسليم في طابور المراجعة اليدوية (AI لم يحسم) */
const manualReviewSubmission = (ctx, overrides = {}) =>
  f.createSubmission(ctx, {
    status: SUBMISSION_STATUS.UNDER_REVIEW,
    aiReview: {
      status: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
      score: null,
      feedback: 'Audio uncertain',
    },
    advertiserReview: { status: ADVERTISER_STATUS.PENDING },
    adminReview: { reasonCode: 'AUDIO_UNCERTAIN', queuedAt: new Date() },
    reviewDeadlineAt: null,
    ...overrides,
  });

const ids = (list) => list.map((item) => String(item.id)).sort();

// ============================================
// §6.1 — GET /campaigns/:campaignId/submissions
// ============================================
describe('getCampaignSubmissions (§6.1)', () => {
  test('الافتراضي AWAITING_ADVERTISER: يعيد فقط ما ينتظر المعلن مع بيانات المبدع', async () => {
    const ctx = await setup();
    const awaiting = await awaitingSubmission(ctx);
    await manualReviewSubmission(ctx);
    await f.createSubmission(ctx, { status: SUBMISSION_STATUS.SUBMITTED });
    await f.createSubmission(ctx, { status: SUBMISSION_STATUS.APPROVED });

    const { data, pagination } = await getCampaignSubmissions(ctx.campaign._id, ctx.brand._id);

    expect(data).toHaveLength(1);
    expect(String(data[0].id)).toBe(String(awaiting._id));
    expect(data[0].displayStatus).toBe(DISPLAY_STATUS.AWAITING_ADVERTISER);
    expect(data[0].preview).toEqual(expect.objectContaining({ caption: expect.any(String) }));
    expect(data[0].checks).toEqual([]);
    expect(data[0].summary).toEqual({ total: 0, passed: 0, failed: 0, needsReview: 0 });
    expect(data[0].creator.fullName).toBe(ctx.creator.fullName);
    expect(String(data[0].creator.id)).toBe(String(ctx.creator._id));
    expect(pagination).toEqual({ page: 1, perPage: 20, total: 1, totalPages: 1 });
  });

  test('displayStatus=ALL يستثني PROCESSING و MANUAL_REVIEW دائمًا', async () => {
    const ctx = await setup();
    const awaiting = await awaitingSubmission(ctx);
    const approved = await f.createSubmission(ctx, { status: SUBMISSION_STATUS.APPROVED });
    await manualReviewSubmission(ctx);
    await f.createSubmission(ctx, { status: SUBMISSION_STATUS.SUBMITTED });

    const { data } = await getCampaignSubmissions(ctx.campaign._id, ctx.brand._id, {
      displayStatus: 'ALL',
    });

    expect(ids(data)).toEqual([String(awaiting._id), String(approved._id)].sort());
  });

  test('يفلتر حسب displayStatus=APPROVED', async () => {
    const ctx = await setup();
    await awaitingSubmission(ctx);
    const approved = await f.createSubmission(ctx, { status: SUBMISSION_STATUS.APPROVED });

    const { data } = await getCampaignSubmissions(ctx.campaign._id, ctx.brand._id, {
      displayStatus: DISPLAY_STATUS.APPROVED,
    });

    expect(ids(data)).toEqual([String(approved._id)]);
  });

  test('يطبّق الترقيم (page/perPage)', async () => {
    const ctx = await setup();
    await awaitingSubmission(ctx);
    await awaitingSubmission(ctx);

    const { data, pagination } = await getCampaignSubmissions(ctx.campaign._id, ctx.brand._id, {
      page: 1,
      perPage: 1,
    });

    expect(data).toHaveLength(1);
    expect(pagination).toEqual({ page: 1, perPage: 1, total: 2, totalPages: 2 });
  });

  test('يرفض حملة براند آخر بـ FORBIDDEN', async () => {
    const ctx = await setup();
    const otherBrand = await f.createBrand();

    const error = await errorOf(
      getCampaignSubmissions(ctx.campaign._id, otherBrand._id)
    );

    expect(error).not.toBeNull();
    expect(error.code).toBe('FORBIDDEN');
  });

  test('يعيد NOT_FOUND لمعرّف حملة غير صالح أو غير موجود', async () => {
    const ctx = await setup();

    const invalid = await errorOf(getCampaignSubmissions('not-an-id', ctx.brand._id));
    const missing = await errorOf(
      getCampaignSubmissions(new mongoose.Types.ObjectId(), ctx.brand._id)
    );

    expect(invalid.code).toBe('NOT_FOUND');
    expect(missing.code).toBe('NOT_FOUND');
  });
});

// ============================================
// §6.2 — PUT /submissions/:id/review
// ============================================
describe('reviewSubmission (§6.2)', () => {
  test('APPROVE: يعتمد التسليم ويزيد إحصائية الحملة ويشعر المبدع', async () => {
    const ctx = await setup();
    const submission = await awaitingSubmission(ctx);

    const result = await reviewSubmission(submission._id, ctx.brand._id, {
      decision: 'APPROVE',
      note: 'عمل ممتاز',
    });

    expect(String(result.id)).toBe(String(submission._id));
    expect(result.status).toBe(SUBMISSION_STATUS.APPROVED);
    expect(result.displayStatus).toBe(DISPLAY_STATUS.APPROVED);
    expect(result.reviewedAt).toBeInstanceOf(Date);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.APPROVED);
    expect(saved.approvedAt).toBeInstanceOf(Date);
    expect(saved.reviewedAt).toBeInstanceOf(Date);
    expect(saved.advertiserReview.status).toBe(ADVERTISER_STATUS.APPROVED);
    expect(String(saved.advertiserReview.reviewedBy)).toBe(String(ctx.brand._id));
    expect(saved.advertiserReview.note).toBe('عمل ممتاز');

    const campaign = await Campaign.findById(ctx.campaign._id);
    expect(campaign.stats.totalApprovedVideos).toBe(1);

    expect(notifyCreatorApproved).toHaveBeenCalledTimes(1);
    const [payload, campaignPayload, options] = notifyCreatorApproved.mock.calls[0];
    expect(String(payload._id)).toBe(String(submission._id));
    expect(String(payload.creatorId)).toBe(String(ctx.creator._id));
    expect(String(campaignPayload._id)).toBe(String(ctx.campaign._id));
    expect(options).toEqual({ auto: false });
    expect(notifyCreatorRejected).not.toHaveBeenCalled();
  });

  test('REJECT: يرفض ويحرر الرابط ويحفظ الملاحظة ويشعر المبدع', async () => {
    const ctx = await setup();
    const submission = await awaitingSubmission(ctx);

    const result = await reviewSubmission(submission._id, ctx.brand._id, {
      decision: 'REJECT',
      note: 'الصوت غير مطابق',
    });

    expect(result.status).toBe(SUBMISSION_STATUS.REJECTED);
    expect(result.displayStatus).toBe(DISPLAY_STATUS.REJECTED);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.REJECTED);
    expect(saved.rejectedBy).toBe(REJECTED_BY.ADVERTISER);
    expect(saved.linkLocked).toBe(false);
    expect(saved.advertiserReview.status).toBe(ADVERTISER_STATUS.REJECTED);
    expect(saved.advertiserReview.note).toBe('الصوت غير مطابق');

    const campaign = await Campaign.findById(ctx.campaign._id);
    expect(campaign.stats.totalApprovedVideos).toBe(0);

    expect(notifyCreatorRejected).toHaveBeenCalledTimes(1);
    expect(notifyCreatorRejected.mock.calls[0][2]).toEqual({ note: 'الصوت غير مطابق' });
    expect(notifyCreatorApproved).not.toHaveBeenCalled();
  });

  test('يرفض مراجعة تسليم ليس في مرحلة المعلن بـ SUBMISSION_ALREADY_REVIEWED', async () => {
    const ctx = await setup();
    const processing = await f.createSubmission(ctx, { status: SUBMISSION_STATUS.SUBMITTED });

    const error = await errorOf(
      reviewSubmission(processing._id, ctx.brand._id, { decision: 'APPROVE' })
    );

    expect(error).not.toBeNull();
    expect(error.code).toBe('SUBMISSION_ALREADY_REVIEWED');
  });

  test('لا يسمح لبراند آخر بمراجعة التسليم (FORBIDDEN)', async () => {
    const ctx = await setup();
    const otherBrand = await f.createBrand();
    const submission = await awaitingSubmission(ctx);

    const error = await errorOf(
      reviewSubmission(submission._id, otherBrand._id, { decision: 'APPROVE' })
    );

    expect(error.code).toBe('FORBIDDEN');
    expect(notifyCreatorApproved).not.toHaveBeenCalled();
  });

  test('يرفض المراجعة إذا كانت الحملة موقوفة (CAMPAIGN_SUSPENDED)', async () => {
    const ctx = await setup({ isSuspended: true });
    const submission = await awaitingSubmission(ctx);

    const error = await errorOf(
      reviewSubmission(submission._id, ctx.brand._id, { decision: 'APPROVE' })
    );

    expect(error.code).toBe('CAMPAIGN_SUSPENDED');
  });

  test('يعيد NOT_FOUND لمعرّف غير صالح أو تسليم غير موجود', async () => {
    const ctx = await setup();

    const invalid = await errorOf(
      reviewSubmission('not-an-id', ctx.brand._id, { decision: 'APPROVE' })
    );
    const missing = await errorOf(
      reviewSubmission(new mongoose.Types.ObjectId(), ctx.brand._id, { decision: 'APPROVE' })
    );

    expect(invalid.code).toBe('NOT_FOUND');
    expect(missing.code).toBe('NOT_FOUND');
  });
});

// ============================================
// §6.3 — GET /admin/submissions/manual-review
// ============================================
describe('getManualReviewQueue (§6.3)', () => {
  test('يعيد طابور المراجعة اليدوية مرتبًا بـ queuedAt تصاعديًا', async () => {
    const ctx = await setup();
    const older = await manualReviewSubmission(ctx, {
      adminReview: {
        reasonCode: 'AUDIO_UNCERTAIN',
        queuedAt: new Date(Date.now() - 2 * HOUR),
      },
    });
    const newer = await manualReviewSubmission(ctx, {
      adminReview: {
        reasonCode: 'AI_UNAVAILABLE',
        queuedAt: new Date(Date.now() - HOUR),
      },
    });
    await awaitingSubmission(ctx);

    const { data, pagination } = await getManualReviewQueue();

    expect(ids(data)).toEqual([String(older._id), String(newer._id)]);
    expect(data[0].manualReview.reasonCode).toBe('AUDIO_UNCERTAIN');
    expect(data[1].manualReview.reasonCode).toBe('AI_UNAVAILABLE');
    expect(data[0].manualReview.queuedAt).toBeInstanceOf(Date);
    expect(data[0].preview).toBeDefined();
    expect(Array.isArray(data[0].checks)).toBe(true);
    expect(data[0].creator.fullName).toBe(ctx.creator.fullName);
    expect(pagination.total).toBe(2);
  });

  test('يستثني ما اتخذ فيه الأدمن قرارًا بالفعل', async () => {
    const ctx = await setup();
    await manualReviewSubmission(ctx, {
      adminReview: {
        reasonCode: 'AUDIO_UNCERTAIN',
        queuedAt: new Date(),
        decision: 'APPROVE',
        reviewedAt: new Date(),
      },
    });

    const { data, pagination } = await getManualReviewQueue();

    expect(data).toHaveLength(0);
    expect(pagination.total).toBe(0);
  });

  test('يطبّق الترقيم', async () => {
    const ctx = await setup();
    await manualReviewSubmission(ctx);
    await manualReviewSubmission(ctx);

    const { data, pagination } = await getManualReviewQueue({ page: 2, perPage: 1 });

    expect(data).toHaveLength(1);
    expect(pagination).toEqual({ page: 2, perPage: 1, total: 2, totalPages: 2 });
  });
});

// ============================================
// §6.4 — PUT /admin/submissions/:id/review
// ============================================
describe('decideManualReview (§6.4)', () => {
  test('APPROVE: ينقل التسليم لمرحلة المعلن ويضبط مهلة جديدة ويشعر البراند', async () => {
    const ctx = await setup();
    const submission = await manualReviewSubmission(ctx);

    const before = Date.now();
    const result = await decideManualReview(submission._id, (await f.createAdmin())._id, {
      decision: 'APPROVE',
      note: 'المقطع سليم',
    });

    expect(result.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(result.displayStatus).toBe(DISPLAY_STATUS.AWAITING_ADVERTISER);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(saved.adminReview.decision).toBe('APPROVE');
    expect(saved.adminReview.note).toBe('المقطع سليم');
    expect(saved.adminReview.reviewedAt).toBeInstanceOf(Date);
    expect(saved.advertiserReview.status).toBe(ADVERTISER_STATUS.PENDING);

    const expectedDeadline = before + SUBMISSION_CONFIG.REVIEW_DEADLINE_HOURS * HOUR;
    expect(saved.reviewDeadlineAt.getTime()).toBeGreaterThanOrEqual(expectedDeadline - 1000);
    expect(saved.reviewDeadlineAt.getTime()).toBeLessThanOrEqual(expectedDeadline + 5000);

    expect(notifyBrandNewSubmission).toHaveBeenCalledTimes(1);
    expect(String(notifyBrandNewSubmission.mock.calls[0][0]._id)).toBe(String(submission._id));
    expect(String(notifyBrandNewSubmission.mock.calls[0][1]._id)).toBe(String(ctx.campaign._id));
  });

  test('REJECT: يرفض التسليم ويسجّل REJECTED_BY.ADMIN ويشعر المبدع', async () => {
    const ctx = await setup();
    const submission = await manualReviewSubmission(ctx);

    const result = await decideManualReview(submission._id, (await f.createAdmin())._id, {
      decision: 'REJECT',
      note: 'مخالف للضوابط',
    });

    expect(result.status).toBe(SUBMISSION_STATUS.REJECTED);
    expect(result.displayStatus).toBe(DISPLAY_STATUS.REJECTED);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.REJECTED);
    expect(saved.rejectedBy).toBe(REJECTED_BY.ADMIN);
    expect(saved.linkLocked).toBe(false);
    expect(saved.adminReview.decision).toBe('REJECT');
    expect(saved.adminReview.note).toBe('مخالف للضوابط');

    expect(notifyCreatorRejected).toHaveBeenCalledTimes(1);
    expect(notifyCreatorRejected.mock.calls[0][2]).toEqual({ note: 'مخالف للضوابط' });
    expect(notifyBrandNewSubmission).not.toHaveBeenCalled();
  });

  test('يرفض تسليمًا ليس في المراجعة اليدوية بـ SUBMISSION_ALREADY_REVIEWED', async () => {
    const ctx = await setup();
    const awaiting = await awaitingSubmission(ctx);

    const error = await errorOf(
      decideManualReview(awaiting._id, (await f.createAdmin())._id, { decision: 'APPROVE' })
    );

    expect(error.code).toBe('SUBMISSION_ALREADY_REVIEWED');
  });

  test('لا يمكن مراجعة التسليم مرتين (تحديث شرطي)', async () => {
    const ctx = await setup();
    const admin = await f.createAdmin();
    const submission = await manualReviewSubmission(ctx);

    await decideManualReview(submission._id, admin._id, { decision: 'APPROVE' });
    const error = await errorOf(
      decideManualReview(submission._id, admin._id, { decision: 'REJECT' })
    );

    expect(error.code).toBe('SUBMISSION_ALREADY_REVIEWED');
    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(saved.adminReview.decision).toBe('APPROVE');
  });

  test('يعيد NOT_FOUND لمعرّف غير صالح', async () => {
    const error = await errorOf(
      decideManualReview('not-an-id', new mongoose.Types.ObjectId(), { decision: 'APPROVE' })
    );

    expect(error.code).toBe('NOT_FOUND');
  });
});

// ============================================
// §8 — autoApproveDueSubmissions (job)
// ============================================
describe('autoApproveDueSubmissions (§8)', () => {
  test('يعتمد التسليمات المنتهية مهلتها ويحدّث الإحصائية ويشعر بـ auto', async () => {
    const ctx = await setup();
    const due = await awaitingSubmission(ctx, {
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 1, approved: 1 });

    const saved = await Submission.findById(due._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.APPROVED);
    expect(saved.approvedAt).toBeInstanceOf(Date);
    expect(saved.advertiserReview.status).toBe(ADVERTISER_STATUS.AUTO_APPROVED);
    expect(saved.advertiserReview.reviewedAt).toBeInstanceOf(Date);

    const campaign = await Campaign.findById(ctx.campaign._id);
    expect(campaign.stats.totalApprovedVideos).toBe(1);

    expect(notifyCreatorApproved).toHaveBeenCalledTimes(1);
    expect(notifyCreatorApproved.mock.calls[0][2]).toEqual({ auto: true });
  });

  test('لا يعتمد ما لم تنتهِ مهلته بعد', async () => {
    const ctx = await setup();
    await awaitingSubmission(ctx, { reviewDeadlineAt: new Date(Date.now() + HOUR) });

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 0, approved: 0 });
    expect(notifyCreatorApproved).not.toHaveBeenCalled();
  });

  test('لا يمسّ التسليمات المعالجة أو المرفوضة أو المسحوبة', async () => {
    const ctx = await setup();
    await f.createSubmission(ctx, {
      status: SUBMISSION_STATUS.SUBMITTED,
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });
    await f.createSubmission(ctx, {
      status: SUBMISSION_STATUS.REJECTED,
      rejectedBy: REJECTED_BY.AI,
      advertiserReview: { status: ADVERTISER_STATUS.PENDING },
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });
    await f.createSubmission(ctx, {
      status: SUBMISSION_STATUS.WITHDRAWN,
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 0, approved: 0 });
  });

  test('ينفّذ على أكثر من تسليم مستحق في نفس الدورة', async () => {
    const ctx = await setup();
    await awaitingSubmission(ctx, { reviewDeadlineAt: new Date(Date.now() - 2 * HOUR) });
    await awaitingSubmission(ctx, { reviewDeadlineAt: new Date(Date.now() - HOUR) });

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 2, approved: 2 });
    const campaign = await Campaign.findById(ctx.campaign._id);
    expect(campaign.stats.totalApprovedVideos).toBe(2);
    expect(notifyCreatorApproved).toHaveBeenCalledTimes(2);
  });

  test('لا يعتمد تسليمًا ينتظر قرار الأدمن حتى لو انتهت مهلته', async () => {
    const ctx = await setup();
    await manualReviewSubmission(ctx, {
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 0, approved: 0 });
    expect(notifyCreatorApproved).not.toHaveBeenCalled();
  });

  test('يعتمد التسليم الذي وافق عليه الأدمن وانتهت مهلة المعلن', async () => {
    const ctx = await setup();
    const submission = await manualReviewSubmission(ctx, {
      adminReview: {
        reasonCode: 'AUDIO_UNCERTAIN',
        queuedAt: new Date(Date.now() - 2 * HOUR),
        decision: 'APPROVE',
      },
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 1, approved: 1 });
    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.APPROVED);
    expect(saved.advertiserReview.status).toBe(ADVERTISER_STATUS.AUTO_APPROVED);
  });

  test('ENABLE_SUBMISSION_AUTO_APPROVE=false يعطّل المهمة بالكامل', async () => {
    const ctx = await setup();
    const due = await awaitingSubmission(ctx, {
      reviewDeadlineAt: new Date(Date.now() - HOUR),
    });
    process.env.ENABLE_SUBMISSION_AUTO_APPROVE = 'false';

    const result = await autoApproveDueSubmissions();

    expect(result).toEqual({ processed: 0, approved: 0 });
    const saved = await Submission.findById(due._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(notifyCreatorApproved).not.toHaveBeenCalled();
  });
});
