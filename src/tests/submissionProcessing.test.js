// src/tests/submissionProcessing.test.js
// المالك: المسار ب — اختبارات معالجة التسليمات بالـ AI (B3).
// المرجع: API_CONTRACT_SPRINT5.md §8
//
// نضرب خدمة الـ AI والإشعارات بـ mocks، ونبقي قاعدة البيانات حقيقية
// لاختبار القفل الذرّي والتحديثات الشرطية والاسترجاع بعد الإقلاع.
require('dotenv').config();

const db = require('./helpers/db');
const f = require('./helpers/factories');
const Submission = require('../models/submission');
const { SUBMISSION_STATUS, REJECTED_BY } = require('../constants/submission.constants');
const { AI_REVIEW_RESULT } = require('../constants/campaign.constants');

jest.mock('../services/ai/aiSubmissionReview.client', () => ({
  buildReviewPayload: jest.fn(() => ({ mocked: true })),
  reviewSubmission: jest.fn(),
}));
jest.mock('../services/submission/submissionNotifications.service', () => ({
  notifyCreatorAiApproved: jest.fn().mockResolvedValue(null),
  notifyCreatorAiRejected: jest.fn().mockResolvedValue(null),
  notifyCreatorManualReview: jest.fn().mockResolvedValue(null),
  notifyAdminsManualReview: jest.fn().mockResolvedValue(null),
  notifyBrandNewSubmission: jest.fn().mockResolvedValue(null),
}));

const { buildReviewPayload, reviewSubmission } = require('../services/ai/aiSubmissionReview.client');
const {
  notifyCreatorAiApproved,
  notifyCreatorAiRejected,
  notifyCreatorManualReview,
  notifyAdminsManualReview,
  notifyBrandNewSubmission,
} = require('../services/submission/submissionNotifications.service');
const {
  processSubmission,
  recoverPendingSubmissions,
} = require('../services/submission/submissionProcessing.service');

jest.setTimeout(120000);

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});
beforeEach(() => {
  reviewSubmission.mockResolvedValue({
    result: AI_REVIEW_RESULT.APPROVED,
    score: 90,
    feedback: '',
    checks: [],
  });
});

// ============================================
// Helpers
// ============================================
const setupEntities = async () => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand);
  const application = await f.createAcceptedApplication(creator, campaign);
  return { brand, creator, campaign, application };
};

const setup = async (submissionOverrides = {}) => {
  const entities = await setupEntities();
  const submission = await f.createSubmission(entities, submissionOverrides);
  return { ...entities, submission };
};

const aiResult = (overrides = {}) => ({
  result: AI_REVIEW_RESULT.APPROVED,
  score: 90,
  feedback: '',
  checks: [],
  ...overrides,
});

// ============================================
// processSubmission — الحالات الأساسية
// ============================================
describe('processSubmission (B3)', () => {
  test('APPROVED: ينقل التسليم لمرحلة المعلن ويشعر المبدع والمعلن', async () => {
    const { creator, submission } = await setup();
    reviewSubmission.mockResolvedValue(
      aiResult({
        score: 96,
        feedback: 'Looks good',
        checks: [{ code: 'VIDEO_FORMAT', status: 'PASSED', message: 'Vertical', score: 100 }],
      })
    );

    const result = await processSubmission(submission._id);

    expect(result).toEqual({ processed: true, result: AI_REVIEW_RESULT.APPROVED });

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.APPROVED);
    expect(saved.aiReview.score).toBe(96);
    expect(saved.aiReview.feedback).toBe('Looks good');
    expect(saved.aiReview.attempts).toBe(1);
    expect(saved.aiReview.reviewedAt).toBeInstanceOf(Date);
    expect(saved.advertiserReview.status).toBe('PENDING');
    expect(saved.processing.lockedAt).toBeNull();
    expect(saved.checks).toHaveLength(1);
    expect(saved.checks[0].source).toBe('AI');

    expect(notifyCreatorAiApproved).toHaveBeenCalledTimes(1);
    expect(notifyBrandNewSubmission).toHaveBeenCalledTimes(1);
  });

  test('يمرّر فحوصات RULES فقط إلى الـ AI (بدون فحوصات AI القديمة)', async () => {
    const { submission } = await setup({
      checks: [
        { code: 'REQUIRED_HASHTAGS', source: 'RULES', status: 'PASSED' },
        { code: 'OLD_AI_CHECK', source: 'AI', status: 'PASSED' },
      ],
    });

    await processSubmission(submission._id);

    expect(buildReviewPayload).toHaveBeenCalledTimes(1);
    const payload = buildReviewPayload.mock.calls[0][0];
    expect(payload.backendChecks).toEqual([{ code: 'REQUIRED_HASHTAGS', status: 'PASSED' }]);
  });

  test('REJECTED: يرفض بـ AI ويحرر الرابط ويسجل أسباب الرفض', async () => {
    const { submission } = await setup();
    reviewSubmission.mockResolvedValue(
      aiResult({
        result: AI_REVIEW_RESULT.REJECTED,
        score: 20,
        feedback: 'Bad audio',
        checks: [
          { code: 'AUDIO_COMPLIANCE', status: 'FAILED', message: 'Background music detected' },
          { code: 'VIDEO_FORMAT', status: 'PASSED', message: 'Vertical' },
        ],
      })
    );

    const result = await processSubmission(submission._id);

    expect(result.processed).toBe(true);
    expect(result.result).toBe(AI_REVIEW_RESULT.REJECTED);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.REJECTED);
    expect(saved.rejectedBy).toBe(REJECTED_BY.AI);
    expect(saved.linkLocked).toBe(false);
    expect(
      saved.rejectionReasons.map((r) => ({ code: r.code, message: r.message }))
    ).toEqual([{ code: 'AUDIO_COMPLIANCE', message: 'Background music detected' }]);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.REJECTED);
    expect(saved.checks).toHaveLength(2);

    expect(notifyCreatorAiRejected).toHaveBeenCalledTimes(1);
    expect(notifyBrandNewSubmission).not.toHaveBeenCalled();
  });

  test('REJECTED بدون فحص فاشل: يضيف سببًا عامًا من feedback', async () => {
    const { submission } = await setup();
    reviewSubmission.mockResolvedValue(
      aiResult({ result: AI_REVIEW_RESULT.REJECTED, feedback: 'Does not meet requirements', checks: [] })
    );

    await processSubmission(submission._id);

    const saved = await Submission.findById(submission._id);
    expect(
      saved.rejectionReasons.map((r) => ({ code: r.code, message: r.message }))
    ).toEqual([{ code: 'GENERAL', message: 'Does not meet requirements' }]);
  });

  test('MANUAL_REVIEW_REQUIRED: يضع الطلب في طابور الأدمن ويشعر الطرفين', async () => {
    const { submission } = await setup();
    reviewSubmission.mockResolvedValue(
      aiResult({
        result: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
        score: null,
        feedback: 'Audio uncertain',
        manualReasonCode: 'AUDIO_UNCERTAIN',
        checks: [],
      })
    );

    const result = await processSubmission(submission._id);

    expect(result.processed).toBe(true);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED);
    expect(saved.adminReview.reasonCode).toBe('AUDIO_UNCERTAIN');
    expect(saved.adminReview.queuedAt).toBeInstanceOf(Date);
    expect(saved.processing.lockedAt).toBeNull();

    expect(notifyCreatorManualReview).toHaveBeenCalledTimes(1);
    expect(notifyAdminsManualReview).toHaveBeenCalledTimes(1);
    expect(notifyAdminsManualReview.mock.calls[0][2]).toBe('AUDIO_UNCERTAIN');
    expect(notifyBrandNewSubmission).not.toHaveBeenCalled();
  });
});

// ============================================
// القفل والتحديث الشرطي
// ============================================
describe('processSubmission — القفل والسباق', () => {
  test('يتخطى تسليمًا مقفولًا حاليًا', async () => {
    const { submission } = await setup({ processing: { lockedAt: new Date() } });

    const result = await processSubmission(submission._id);

    expect(result).toEqual({ skipped: true });
    expect(reviewSubmission).not.toHaveBeenCalled();
  });

  test('يعالج تسليمًا قفله قديم (أكثر من 5 دقائق)', async () => {
    const { submission } = await setup({
      processing: { lockedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const result = await processSubmission(submission._id);

    expect(result.processed).toBe(true);
    expect(reviewSubmission).toHaveBeenCalledTimes(1);
  });

  test('التشغيل الثاني بعد المعالجة يتخطى (لا معالجة مزدوجة)', async () => {
    const { submission } = await setup();

    const first = await processSubmission(submission._id);
    const second = await processSubmission(submission._id);

    expect(first.processed).toBe(true);
    expect(second).toEqual({ skipped: true });
    expect(reviewSubmission).toHaveBeenCalledTimes(1);
  });

  test('لا يكتب نتيجة AI إذا تغيّرت الحالة أثناء الاستدعاء (تحديث شرطي)', async () => {
    const { submission } = await setup();
    reviewSubmission.mockImplementation(async () => {
      await Submission.updateOne(
        { _id: submission._id },
        { $set: { status: SUBMISSION_STATUS.WITHDRAWN } }
      );
      return aiResult({ result: AI_REVIEW_RESULT.APPROVED, score: 99 });
    });

    await processSubmission(submission._id);

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.WITHDRAWN);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.PENDING);
    expect(saved.aiReview.score).toBeNull();
    expect(notifyCreatorAiApproved).not.toHaveBeenCalled();
    expect(notifyBrandNewSubmission).not.toHaveBeenCalled();
  });
});

// ============================================
// الفشل وإعادة المحاولة
// ============================================
describe('processSubmission — فشل الـ AI', () => {
  test('فشل غير نهائي: يحرر القفل ويبقي PENDING للمحاولة التالية', async () => {
    const { submission } = await setup();
    reviewSubmission.mockRejectedValue(new Error('AI service down'));

    const result = await processSubmission(submission._id);

    expect(result).toEqual({ processed: false, failed: true, attempts: 1 });

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.SUBMITTED);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.PENDING);
    expect(saved.aiReview.attempts).toBe(1);
    expect(saved.aiReview.lastError).toBe('AI service down');
    expect(saved.processing.lockedAt).toBeNull();
    expect(notifyCreatorManualReview).not.toHaveBeenCalled();
  });

  test('المحاولة الثالثة: يحوّل للمراجعة اليدوية بسبب AI_UNAVAILABLE', async () => {
    const { submission } = await setup({ aiReview: { status: AI_REVIEW_RESULT.PENDING, attempts: 2 } });
    reviewSubmission.mockRejectedValue(new Error('timeout'));

    const result = await processSubmission(submission._id);

    expect(result).toEqual({ processed: false, exhausted: true, attempts: 3 });

    const saved = await Submission.findById(submission._id);
    expect(saved.status).toBe(SUBMISSION_STATUS.UNDER_REVIEW);
    expect(saved.aiReview.status).toBe(AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED);
    expect(saved.aiReview.lastError).toBe('timeout');
    expect(saved.adminReview.reasonCode).toBe('AI_UNAVAILABLE');
    expect(saved.adminReview.queuedAt).toBeInstanceOf(Date);
    expect(saved.processing.lockedAt).toBeNull();

    expect(notifyCreatorManualReview).toHaveBeenCalledTimes(1);
    expect(notifyAdminsManualReview).toHaveBeenCalledTimes(1);
    expect(notifyAdminsManualReview.mock.calls[0][2]).toBe('AI_UNAVAILABLE');
  });
});

// ============================================
// recoverPendingSubmissions — catch-up بعد الإقلاع
// ============================================
describe('recoverPendingSubmissions (§8)', () => {
  test('يلتقط PENDING غير المقفول أو قفله قديم، ويتجاهل القفل الحديث', async () => {
    const { creator, campaign, application } = await setupEntities();
    const unlocked = await f.createSubmission(
      { creator, campaign, application },
      { externalId: 'unlocked-1' }
    );
    const stale = await f.createSubmission(
      { creator, campaign, application },
      {
        externalId: 'stale-1',
        processing: { lockedAt: new Date(Date.now() - 10 * 60 * 1000) },
      }
    );
    await f.createSubmission(
      { creator, campaign, application },
      { externalId: 'locked-1', processing: { lockedAt: new Date() } }
    );

    const results = await recoverPendingSubmissions(20);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.processed)).toBe(true);
    expect(results.map((r) => String(r.id)).sort()).toEqual(
      [String(unlocked._id), String(stale._id)].sort()
    );
    expect(reviewSubmission).toHaveBeenCalledTimes(2);
  });

  test('يحترم حد الدفعة (limit)', async () => {
    const { creator, campaign, application } = await setupEntities();
    for (let i = 0; i < 3; i += 1) {
      await f.createSubmission(
        { creator, campaign, application },
        { externalId: `batch-${i}` }
      );
    }

    const results = await recoverPendingSubmissions(2);

    expect(results).toHaveLength(2);
    expect(reviewSubmission).toHaveBeenCalledTimes(2);
  });

  test('لا يلتقط التسليمات المعالجة أو المرفوضة', async () => {
    const { creator, campaign, application } = await setupEntities();
    await f.createSubmission(
      { creator, campaign, application },
      {
        externalId: 'done-1',
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        aiReview: { status: AI_REVIEW_RESULT.APPROVED, score: 90 },
      }
    );
    await f.createSubmission(
      { creator, campaign, application },
      {
        externalId: 'rej-1',
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: REJECTED_BY.AI,
      }
    );

    const results = await recoverPendingSubmissions(20);

    expect(results).toHaveLength(0);
    expect(reviewSubmission).not.toHaveBeenCalled();
  });
});
