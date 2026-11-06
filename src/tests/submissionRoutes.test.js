// src/tests/submissionRoutes.test.js
// المالك: المسار ب — اختبارات طبقة HTTP لمسارات التسليم والمراجعة.
// المرجع: API_CONTRACT_SPRINT5.md §5 + §6
//
// الخدمات مُستبدلة بـ mocks (المنطق مغطّى في submissionLifecycle/Processing/Review)،
// ونركّز هنا على: المصادقة، الأدوار، التحقق من المدخلات، ترتيب المسارات،
// وأشكال الاستجابات (نجاح/خطأ).
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const db = require('./helpers/db');
const f = require('./helpers/factories');
const { AppError } = require('../utils/errors');

jest.mock('../services/submission/submission.service', () => ({
  createSubmission: jest.fn(),
  getMySubmissions: jest.fn(),
  getSubmissionById: jest.fn(),
  withdrawSubmission: jest.fn(),
  updateSubmissionLink: jest.fn(),
  resubmitSubmission: jest.fn(),
}));

jest.mock('../services/submission/submissionReview.service', () => ({
  getCampaignSubmissions: jest.fn(),
  reviewSubmission: jest.fn(),
  getManualReviewQueue: jest.fn(),
  decideManualReview: jest.fn(),
  autoApproveDueSubmissions: jest.fn(),
}));

const submissionService = require('../services/submission/submission.service');
const submissionReviewService = require('../services/submission/submissionReview.service');

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
const API = '/api/v1';
const objectId = () => new mongoose.Types.ObjectId().toString();

const setupUsers = async () => {
  const clipper = await f.createUser();
  const brand = await f.createBrand();
  const admin = await f.createAdmin();
  return { clipper, brand, admin };
};

const validCreateBody = (overrides = {}) => ({
  platform: 'TIKTOK',
  url: 'https://www.tiktok.com/@user/video/123',
  hashtags: ['#halal'],
  keywords: [],
  notes: '',
  halalPledge: true,
  ...overrides,
});

const pageMeta = { page: 1, perPage: 20, total: 0, totalPages: 0 };

beforeEach(() => {
  submissionService.createSubmission.mockResolvedValue({ id: 'sub-1', status: 'SUBMITTED' });
  submissionService.getMySubmissions.mockResolvedValue({ data: [], pagination: pageMeta });
  submissionService.getSubmissionById.mockResolvedValue({ id: 'sub-1' });
  submissionService.withdrawSubmission.mockResolvedValue({ id: 'sub-1', status: 'WITHDRAWN' });
  submissionService.updateSubmissionLink.mockResolvedValue({ id: 'sub-1', status: 'SUBMITTED' });
  submissionService.resubmitSubmission.mockResolvedValue({ id: 'sub-2', attempt: 2 });

  submissionReviewService.getCampaignSubmissions.mockResolvedValue({ data: [], pagination: pageMeta });
  submissionReviewService.reviewSubmission.mockResolvedValue({ id: 'sub-1', status: 'APPROVED' });
  submissionReviewService.getManualReviewQueue.mockResolvedValue({ data: [], pagination: pageMeta });
  submissionReviewService.decideManualReview.mockResolvedValue({ id: 'sub-1', status: 'UNDER_REVIEW' });
});

// ============================================
// المصادقة
// ============================================
describe('المصادقة', () => {
  test('بدون توكن: 401 على مسارات المبدع', async () => {
    const res = await request(app).get(`${API}/submissions/my`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Token missing/);
    expect(submissionService.getMySubmissions).not.toHaveBeenCalled();
  });

  test('بدون توكن: 401 على مسار مراجعة المعلن', async () => {
    const res = await request(app)
      .put(`${API}/submissions/${objectId()}/review`)
      .send({ decision: 'APPROVE' });

    expect(res.status).toBe(401);
  });

  test('توكن غير صالح: 401', async () => {
    const res = await request(app)
      .get(`${API}/submissions/my`)
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// الأدوار
// ============================================
describe('الأدوار', () => {
  test('BRAND لا يستطيع إنشاء تسليم (403 FORBIDDEN)', async () => {
    const { brand } = await setupUsers();

    const res = await request(app)
      .post(`${API}/campaigns/${objectId()}/submissions`)
      .set(f.authHeader(brand))
      .send(validCreateBody());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(submissionService.createSubmission).not.toHaveBeenCalled();
  });

  test('CLIPPER لا يستطيع عرض تسليمات الحملة (مسار المعلن)', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .get(`${API}/campaigns/${objectId()}/submissions`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/brand accounts/i);
    expect(submissionReviewService.getCampaignSubmissions).not.toHaveBeenCalled();
  });

  test('CLIPPER لا يستطيع مراجعة تسليم', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .put(`${API}/submissions/${objectId()}/review`)
      .set(f.authHeader(clipper))
      .send({ decision: 'APPROVE' });

    expect(res.status).toBe(403);
    expect(submissionReviewService.reviewSubmission).not.toHaveBeenCalled();
  });

  test('BRAND لا يستطيع الوصول لطابور المراجعة اليدوية (ADMIN فقط)', async () => {
    const { brand } = await setupUsers();

    const res = await request(app)
      .get(`${API}/admin/submissions/manual-review`)
      .set(f.authHeader(brand));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(submissionReviewService.getManualReviewQueue).not.toHaveBeenCalled();
  });

  test('ADMIN يصل لطابور المراجعة اليدوية', async () => {
    const { admin } = await setupUsers();

    const res = await request(app)
      .get(`${API}/admin/submissions/manual-review`)
      .set(f.authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [], pagination: pageMeta });
  });

  test('بادئة الأدمن غير مكرّرة (admin/admin غير موجودة)', async () => {
    const { admin } = await setupUsers();

    const res = await request(app)
      .get(`${API}/admin/admin/submissions/manual-review`)
      .set(f.authHeader(admin));

    expect(res.status).toBe(404);
  });
});

// ============================================
// التحقق من المدخلات (Joi)
// ============================================
describe('التحقق من المدخلات', () => {
  test('إنشاء تسليم بدون halalPledge: 400 VALIDATION_ERROR + errors[]', async () => {
    const { clipper } = await setupUsers();
    const body = validCreateBody();
    delete body.halalPledge;

    const res = await request(app)
      .post(`${API}/campaigns/${objectId()}/submissions`)
      .set(f.authHeader(clipper))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.map((e) => e.field)).toContain('halalPledge');
    expect(submissionService.createSubmission).not.toHaveBeenCalled();
  });

  test('إنشاء تسليم برابط غير HTTPS: 400', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .post(`${API}/campaigns/${objectId()}/submissions`)
      .set(f.authHeader(clipper))
      .send(validCreateBody({ url: 'http://example.com/video' }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e) => e.field)).toContain('url');
  });

  test('معرّف حملة غير صالح في المسار: 400', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .post(`${API}/campaigns/not-an-id/submissions`)
      .set(f.authHeader(clipper))
      .send(validCreateBody());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e) => e.field)).toContain('campaignId');
  });

  test('GET /submissions/my: perPage أكبر من 50 → 400', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .get(`${API}/submissions/my?perPage=100`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('قائمة المعلن: displayStatus غير مدعوم → 400', async () => {
    const { brand } = await setupUsers();

    const res = await request(app)
      .get(`${API}/campaigns/${objectId()}/submissions?displayStatus=BOGUS`)
      .set(f.authHeader(brand));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('مراجعة المعلن بدون decision: 400', async () => {
    const { brand } = await setupUsers();

    const res = await request(app)
      .put(`${API}/submissions/${objectId()}/review`)
      .set(f.authHeader(brand))
      .send({ note: 'بدون قرار' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e) => e.field)).toContain('decision');
  });

  test('مراجعة المعلن REJECT بدون note: 400', async () => {
    const { brand } = await setupUsers();

    const res = await request(app)
      .put(`${API}/submissions/${objectId()}/review`)
      .set(f.authHeader(brand))
      .send({ decision: 'REJECT' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e) => e.field)).toContain('note');
  });

  test('مراجعة الأدمن REJECT بدون note: 400', async () => {
    const { admin } = await setupUsers();

    const res = await request(app)
      .put(`${API}/admin/submissions/${objectId()}/review`)
      .set(f.authHeader(admin))
      .send({ decision: 'REJECT' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e) => e.field)).toContain('note');
  });

  test('تحديث الرابط بدون url: 400', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .put(`${API}/submissions/${objectId()}/link`)
      .set(f.authHeader(clipper))
      .send({ reason: 'بدون رابط' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.map((e) => e.field)).toContain('url');
  });
});

// ============================================
// مسارات المبدع — النجاح
// ============================================
describe('مسارات المبدع', () => {
  test('POST /campaigns/:id/submissions: 201 ويحذف الحقول غير المعروفة', async () => {
    const { clipper } = await setupUsers();
    const campaignId = objectId();

    const res = await request(app)
      .post(`${API}/campaigns/${campaignId}/submissions`)
      .set(f.authHeader(clipper))
      .send(validCreateBody({ extraField: 'ignored' }));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 'sub-1', status: 'SUBMITTED' } });

    expect(submissionService.createSubmission).toHaveBeenCalledTimes(1);
    const [userId, passedCampaignId, body] = submissionService.createSubmission.mock.calls[0];
    expect(String(userId)).toBe(String(clipper._id));
    expect(passedCampaignId).toBe(campaignId);
    expect(body).not.toHaveProperty('extraField');
    expect(body).toEqual(validCreateBody());
  });

  test('GET /submissions/my: 200 مع data و pagination', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .get(`${API}/submissions/my?displayStatus=APPROVED&page=2&perPage=5`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toEqual(pageMeta);
    expect(submissionService.getMySubmissions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ displayStatus: 'APPROVED', page: 2, perPage: 5 })
    );
  });

  test('GET /submissions/:id: 200', async () => {
    const { clipper } = await setupUsers();
    const id = objectId();

    const res = await request(app)
      .get(`${API}/submissions/${id}`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('sub-1');
    expect(submissionService.getSubmissionById).toHaveBeenCalledWith(id, expect.anything());
  });

  test('DELETE /submissions/:id: 200 (سحب)', async () => {
    const { clipper } = await setupUsers();
    const id = objectId();

    const res = await request(app)
      .delete(`${API}/submissions/${id}`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WITHDRAWN');
    expect(submissionService.withdrawSubmission).toHaveBeenCalledWith(id, expect.anything());
  });

  test('PUT /submissions/:id/link: 200', async () => {
    const { clipper } = await setupUsers();
    const id = objectId();

    const res = await request(app)
      .put(`${API}/submissions/${id}/link`)
      .set(f.authHeader(clipper))
      .send({ url: 'https://www.tiktok.com/@user/video/999', reason: 'إعادة نشر' });

    expect(res.status).toBe(200);
    expect(submissionService.updateSubmissionLink).toHaveBeenCalledWith(id, expect.anything(), {
      url: 'https://www.tiktok.com/@user/video/999',
      reason: 'إعادة نشر',
    });
  });

  test('POST /submissions/:id/resubmit: 201', async () => {
    const { clipper } = await setupUsers();
    const id = objectId();

    const res = await request(app)
      .post(`${API}/submissions/${id}/resubmit`)
      .set(f.authHeader(clipper))
      .send({ url: 'https://www.tiktok.com/@user/video/888' });

    expect(res.status).toBe(201);
    expect(res.body.data.attempt).toBe(2);
    expect(submissionService.resubmitSubmission).toHaveBeenCalledWith(id, expect.anything(), {
      url: 'https://www.tiktok.com/@user/video/888',
    });
  });

  test('GET /submissions/my لا يتعارض مع /submissions/:id (ترتيب المسارات)', async () => {
    const { clipper } = await setupUsers();

    const res = await request(app)
      .get(`${API}/submissions/my`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(200);
    expect(submissionService.getSubmissionById).not.toHaveBeenCalled();
  });
});

// ============================================
// مسارات المعلن والأدمن — النجاح
// ============================================
describe('مسارات المراجعة', () => {
  test('GET /campaigns/:id/submissions: 200 ويطبّق القيم الافتراضية', async () => {
    const { brand } = await setupUsers();
    const campaignId = objectId();

    const res = await request(app)
      .get(`${API}/campaigns/${campaignId}/submissions`)
      .set(f.authHeader(brand));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [], pagination: pageMeta });
    expect(submissionReviewService.getCampaignSubmissions).toHaveBeenCalledWith(
      campaignId,
      expect.anything(),
      expect.objectContaining({ displayStatus: 'AWAITING_ADVERTISER', page: 1, perPage: 20 })
    );
  });

  test('PUT /submissions/:id/review: 200', async () => {
    const { brand } = await setupUsers();
    const id = objectId();

    const res = await request(app)
      .put(`${API}/submissions/${id}/review`)
      .set(f.authHeader(brand))
      .send({ decision: 'APPROVE', note: 'ممتاز' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(submissionReviewService.reviewSubmission).toHaveBeenCalledWith(id, expect.anything(), {
      decision: 'APPROVE',
      note: 'ممتاز',
    });
  });

  test('PUT /admin/submissions/:id/review: 200', async () => {
    const { admin } = await setupUsers();
    const id = objectId();

    const res = await request(app)
      .put(`${API}/admin/submissions/${id}/review`)
      .set(f.authHeader(admin))
      .send({ decision: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNDER_REVIEW');
    expect(submissionReviewService.decideManualReview).toHaveBeenCalledWith(id, expect.anything(), {
      decision: 'APPROVE',
      note: undefined,
    });
  });
});

// ============================================
// تحويل أخطاء الخدمة إلى HTTP
// ============================================
describe('أخطاء الخدمة', () => {
  test('AppError يُترجم إلى status/code/message الصحيحة', async () => {
    const { clipper } = await setupUsers();
    submissionService.withdrawSubmission.mockRejectedValueOnce(
      new AppError('Submission cannot be withdrawn now', 'SUBMISSION_NOT_WITHDRAWABLE')
    );

    const res = await request(app)
      .delete(`${API}/submissions/${objectId()}`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Submission cannot be withdrawn now',
      code: 'SUBMISSION_NOT_WITHDRAWABLE',
    });
  });

  test('خطأ غير متوقع: 500 برسالة عامة دون كشف التفاصيل', async () => {
    const { clipper } = await setupUsers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    submissionService.getSubmissionById.mockRejectedValueOnce(new Error('DB exploded'));

    const res = await request(app)
      .get(`${API}/submissions/${objectId()}`)
      .set(f.authHeader(clipper));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Server error',
      code: 'INTERNAL_ERROR',
    });
    expect(res.body.message).not.toContain('DB exploded');
    errorSpy.mockRestore();
  });

  test('تفاصيل CONTENT_REQUIREMENTS_NOT_MET تُمرَّر في details', async () => {
    const { clipper } = await setupUsers();
    const details = { missingHashtags: ['#wafi'] };
    submissionService.createSubmission.mockRejectedValueOnce(
      new AppError('Content requirements not met', 'CONTENT_REQUIREMENTS_NOT_MET', undefined, details)
    );

    const res = await request(app)
      .post(`${API}/campaigns/${objectId()}/submissions`)
      .set(f.authHeader(clipper))
      .send(validCreateBody());

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CONTENT_REQUIREMENTS_NOT_MET');
    expect(res.body.details).toEqual(details);
  });
});
