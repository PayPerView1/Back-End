// src/tests/wallet/routes.test.js
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const RefundRequest = require('../../models/refundRequest');
const Campaign = require('../../models/campaign');
const generateToken = require('../../utils/generateTokens');

// Mocks
jest.mock('../../services/wallet/paypal.service');
const paypalService = require('../../services/wallet/paypal.service');

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendFundingSuccessEmail: jest.fn().mockResolvedValue(true),
  sendFundingFailedEmail: jest.fn().mockResolvedValue(true),
  sendBankTransferReceivedEmail: jest.fn().mockResolvedValue(true),
  sendBankTransferApprovedEmail: jest.fn().mockResolvedValue(true),
  sendBankTransferRejectedEmail: jest.fn().mockResolvedValue(true),
  sendBudgetExhaustedEmail: jest.fn().mockResolvedValue(true),
  sendRefundSubmittedEmail: jest.fn().mockResolvedValue(true),
  sendRefundApprovedEmail: jest.fn().mockResolvedValue(true),
  sendRefundRejectedEmail: jest.fn().mockResolvedValue(true),
  sendRefundCancelledEmail: jest.fn().mockResolvedValue(true),
}));

// Setup
let mongoServer;
let brandUser, brandToken, brandWallet;
let otherBrandUser, otherBrandToken, otherBrandWallet;
let clipperUser, clipperToken;
let adminUser, adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Wallet.deleteMany({});
  await Transaction.deleteMany({});
  await RefundRequest.deleteMany({});
  await Campaign.deleteMany({});
  jest.clearAllMocks();

  brandUser = await User.create({
    fullName: 'Brand Owner',
    email: 'brand@example.com',
    password: 'hashedPassword123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);
  brandWallet = await Wallet.create({
    advertiserId: brandUser._id,
    balance: 1000,
    lastPaymentMethod: 'PAYPAL',
  });

  otherBrandUser = await User.create({
    fullName: 'Other Brand',
    email: 'other@example.com',
    password: 'hashedPassword123',
    role: 'BRAND',
  });
  otherBrandToken = generateToken(otherBrandUser._id, otherBrandUser.role);
  otherBrandWallet = await Wallet.create({
    advertiserId: otherBrandUser._id,
    balance: 500,
  });

  clipperUser = await User.create({
    fullName: 'Clipper',
    email: 'clipper@example.com',
    password: 'hashedPassword123',
    role: 'CLIPPER',
  });
  clipperToken = generateToken(clipperUser._id, clipperUser.role);

  adminUser = await User.create({
    fullName: 'Admin',
    email: 'admin@example.com',
    password: 'hashedPassword123',
    role: 'ADMIN',
  });
  adminToken = generateToken(adminUser._id, adminUser.role);
});

const validCampaignPayload = (advertiserId, overrides = {}) => ({
  advertiserId,
  name: 'Test Campaign',
  contentType: 'UGC',
  category: 'UGC',
  totalBudget: 500,
  remainingBudget: 500,
  cpm: 10,
  brief: { mainIdea: 'Test brief' },
  targetCountries: ['SAU'],
  ...overrides,
});

// ============================================
// T-B-01: GET /wallet
// ============================================
describe('T-B-01: GET /api/v1/wallet', () => {
  it('✅ BRAND: يرجع المحفظة', async () => {
    const res = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.balance).toBe(1000);
  });

  it('❌ بدون توكن: 401', async () => {
    const res = await request(app).get('/api/v1/wallet');
    expect(res.statusCode).toBe(401);
  });

  it('❌ CLIPPER: 403', async () => {
    const res = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${clipperToken}`);
    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-01: GET /wallet/bank-details
// ============================================
describe('T-B-01: GET /api/v1/wallet/bank-details', () => {
  it('✅ BRAND: يرجع بيانات البنك', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/bank-details')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('❌ بدون توكن: 401', async () => {
    const res = await request(app).get('/api/v1/wallet/bank-details');
    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// T-B-01: POST /wallet/fund
// ============================================
describe('T-B-01: POST /api/v1/wallet/fund', () => {
  it('❌ amount < 10 → AMOUNT_TOO_LOW', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 5, paymentMethod: 'PAYPAL' });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('AMOUNT_TOO_LOW');
  });

  it('❌ amount > 10000 → AMOUNT_TOO_HIGH', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 50000, paymentMethod: 'PAYPAL' });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('AMOUNT_TOO_HIGH');
  });

  it('❌ amount غير رقمي → 400', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 'abc', paymentMethod: 'PAYPAL' });

    expect(res.statusCode).toBe(400);
  });

  it('❌ paymentMethod غير صحيح → 400', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100, paymentMethod: 'BITCOIN' });

    expect(res.statusCode).toBe(400);
  });

  it('✅ PAYPAL: يرجع redirectUrl', async () => {
    paypalService.createOrder.mockResolvedValue({
      orderId: 'PAYPAL_ORDER_123',
      redirectUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=XXX',
    });

    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 500, paymentMethod: 'PAYPAL' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.redirectUrl).toContain('paypal.com');
  });

  it('✅ BANK_TRANSFER: يرجع bankDetails', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 500, paymentMethod: 'BANK_TRANSFER' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('UNDER_REVIEW');
    expect(res.body.data.bankDetails).toBeDefined();
  });

  it('❌ CLIPPER: 403', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ amount: 500, paymentMethod: 'PAYPAL' });

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون توكن: 401', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/fund')
      .send({ amount: 500, paymentMethod: 'PAYPAL' });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// T-B-01: Admin Bank Transfer Review
// ============================================
describe('T-B-01: PUT /api/v1/admin/wallet/bank-transfer/:id', () => {
  it('❌ BRAND: 403', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/api/v1/admin/wallet/bank-transfer/${fakeId}`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'APPROVE' });

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون توكن: 401', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/api/v1/admin/wallet/bank-transfer/${fakeId}`)
      .send({ action: 'APPROVE' });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// T-B-02: GET /wallet/transactions
// ============================================
describe('T-B-02: GET /api/v1/wallet/transactions', () => {
  it('✅ قائمة فاضية', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('✅ يرجع كل المعاملات', async () => {
    await Transaction.create([
      { walletId: brandWallet._id, type: 'CREDIT', grossAmount: 500, netAmount: 500, status: 'COMPLETED' },
      { walletId: brandWallet._id, type: 'DEBIT', grossAmount: 100, netAmount: 100, status: 'COMPLETED' },
    ]);

    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('✅ filter by type=CREDIT', async () => {
    await Transaction.create([
      { walletId: brandWallet._id, type: 'CREDIT', grossAmount: 500, netAmount: 500, status: 'COMPLETED' },
      { walletId: brandWallet._id, type: 'DEBIT', grossAmount: 100, netAmount: 100, status: 'COMPLETED' },
    ]);

    const res = await request(app)
      .get('/api/v1/wallet/transactions?type=CREDIT')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('✅ paymentMethod silently ignored', async () => {
    await Transaction.create({
      walletId: brandWallet._id,
      type: 'CREDIT',
      grossAmount: 500,
      netAmount: 500,
      status: 'COMPLETED',
      paymentMethod: 'BANK_TRANSFER',
    });

    const res = await request(app)
      .get('/api/v1/wallet/transactions?paymentMethod=PAYPAL')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('✅ pagination', async () => {
    const txs = Array.from({ length: 25 }, (_, i) => ({
      walletId: brandWallet._id,
      type: 'CREDIT',
      grossAmount: 100 + i,
      netAmount: 100 + i,
      status: 'COMPLETED',
    }));
    await Transaction.create(txs);

    const res = await request(app)
      .get('/api/v1/wallet/transactions?page=2&perPage=10')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.body.data.length).toBe(10);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.total).toBe(25);
  });

  it('✅ perPage cap at 100', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/transactions?perPage=500')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.body.pagination.perPage).toBe(100);
  });

  it('❌ بدون توكن: 401', async () => {
    const res = await request(app).get('/api/v1/wallet/transactions');
    expect(res.statusCode).toBe(401);
  });

  it('❌ CLIPPER: 403', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${clipperToken}`);
    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-02: GET /wallet/transactions/:id
// ============================================
describe('T-B-02: GET /api/v1/wallet/transactions/:id', () => {
  it('✅ تفاصيل المعاملة', async () => {
    const tx = await Transaction.create({
      walletId: brandWallet._id,
      type: 'CREDIT',
      grossAmount: 500,
      netAmount: 500,
      status: 'COMPLETED',
    });

    const res = await request(app)
      .get(`/api/v1/wallet/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(tx._id.toString());
  });

  it('❌ معاملة معلن تاني: 404', async () => {
    const tx = await Transaction.create({
      walletId: otherBrandWallet._id,
      type: 'CREDIT',
      grossAmount: 500,
      netAmount: 500,
      status: 'COMPLETED',
    });

    const res = await request(app)
      .get(`/api/v1/wallet/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('❌ غير موجودة: 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/v1/wallet/transactions/${fakeId}`)
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.statusCode).toBe(404);
  });

  it('❌ ID غير صحيح: 404', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/transactions/abc')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.statusCode).toBe(404);
  });
});

// ============================================
// T-B-02: GET /wallet/transactions/export
// ============================================
describe('T-B-02: GET /api/v1/wallet/transactions/export', () => {
  it('✅ يرجع ملف Excel', async () => {
    await Transaction.create({
      walletId: brandWallet._id,
      type: 'CREDIT',
      grossAmount: 500,
      netAmount: 500,
      status: 'COMPLETED',
    });

    const res = await request(app)
      .get('/api/v1/wallet/transactions/export')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });

  it('❌ بدون توكن: 401', async () => {
    const res = await request(app).get('/api/v1/wallet/transactions/export');
    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// T-B-03: POST /wallet/refund
// ============================================
describe('T-B-03: POST /api/v1/wallet/refund', () => {
  it('❌ amount < 10 → AMOUNT_TOO_LOW', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 5 });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('AMOUNT_TOO_LOW');
  });

  it('❌ amount > freeBalance → INSUFFICIENT_BALANCE', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 5000 });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('✅ ينشئ طلب استرداد ناجح', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('PENDING');

    const walletAfter = await Wallet.findById(brandWallet._id);
    expect(walletAfter.balance).toBe(900);
  });

  it('❌ CLIPPER: 403', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${clipperToken}`)
      .send({ amount: 100 });

    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-03: DELETE /wallet/refund/:id
// ============================================
describe('T-B-03: DELETE /api/v1/wallet/refund/:id', () => {
  it('✅ إلغاء PENDING ويرجع المبلغ', async () => {
    const submitRes = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    const refundId = submitRes.body.data.refundRequestId;

    const res = await request(app)
      .delete(`/api/v1/wallet/refund/${refundId}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');

    const walletAfter = await Wallet.findById(brandWallet._id);
    expect(walletAfter.balance).toBe(1000);
  });

  it('❌ بعد APPROVED: 409 REFUND_NOT_CANCELLABLE', async () => {
    const submitRes = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    const refundId = submitRes.body.data.refundRequestId;

    await RefundRequest.findByIdAndUpdate(refundId, { status: 'APPROVED' });

    const res = await request(app)
      .delete(`/api/v1/wallet/refund/${refundId}`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('REFUND_NOT_CANCELLABLE');
  });

  it('❌ غير موجود: 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/v1/wallet/refund/${fakeId}`)
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.statusCode).toBe(404);
  });
});

// ============================================
// T-B-03: GET /wallet/refunds
// ============================================
describe('T-B-03: GET /api/v1/wallet/refunds', () => {
  it('✅ يرجع قائمة الاسترداد', async () => {
    await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 50 });

    const res = await request(app)
      .get('/api/v1/wallet/refunds')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('✅ قائمة فاضية', async () => {
    const res = await request(app)
      .get('/api/v1/wallet/refunds')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.body.data).toEqual([]);
  });
});

// ============================================
// T-B-03: Admin Refund Review
// ============================================
describe('T-B-03: PUT /api/v1/admin/wallet/refund/:id', () => {
  it('✅ APPROVE', async () => {
    const submitRes = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    const refundId = submitRes.body.data.refundRequestId;

    const res = await request(app)
      .put(`/api/v1/admin/wallet/refund/${refundId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('✅ REJECT + note يرجّع المبلغ', async () => {
    const submitRes = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    const refundId = submitRes.body.data.refundRequestId;

    const res = await request(app)
      .put(`/api/v1/admin/wallet/refund/${refundId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REJECT', note: 'Suspicious activity' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const walletAfter = await Wallet.findById(brandWallet._id);
    expect(walletAfter.balance).toBe(1000);
  });

  it('❌ REJECT بدون note: 400', async () => {
    const submitRes = await request(app)
      .post('/api/v1/wallet/refund')
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    const refundId = submitRes.body.data.refundRequestId;

    const res = await request(app)
      .put(`/api/v1/admin/wallet/refund/${refundId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REJECT' });

    expect(res.statusCode).toBe(400);
  });

  it('❌ BRAND: 403', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/api/v1/admin/wallet/refund/${fakeId}`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ action: 'APPROVE' });

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون توكن: 401', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/api/v1/admin/wallet/refund/${fakeId}`)
      .send({ action: 'APPROVE' });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// T-B-04: PUT /campaigns/:id/budget
// ============================================
describe('T-B-04: PUT /api/v1/campaigns/:id/budget', () => {
  it('✅ تخصيص ميزانية ناجح', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, {
        totalBudget: 1,
        remainingBudget: 1,
      })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/budget`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalBudget).toBe(100);
  });

  it('❌ رصيد غير كافي → INSUFFICIENT_BALANCE', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, {
        totalBudget: 1,
        remainingBudget: 1,
      })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/budget`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 99999 });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('❌ حملة معلن تاني: 403', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(otherBrandUser._id)
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/budget`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 50 });

    expect(res.statusCode).toBe(403);
  });

  it('❌ بدون توكن: 401', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id)
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/budget`)
      .send({ amount: 50 });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// T-B-04: PUT /campaigns/:id/daily-budget
// ============================================
describe('T-B-04: PUT /api/v1/campaigns/:id/daily-budget', () => {
  it('✅ تعيين حد يومي', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id)
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/daily-budget`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ dailyBudgetLimit: 50 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.dailyBudgetLimit).toBe(50);
  });

  it('❌ الحد أكبر من totalBudget: 400', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, {
        totalBudget: 100,
        remainingBudget: 100,
      })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/daily-budget`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ dailyBudgetLimit: 500 });

    expect(res.statusCode).toBe(400);
  });

  it('✅ null يشيل الحد', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, { dailyBudgetLimit: 50 })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/daily-budget`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ dailyBudgetLimit: null });

    expect(res.statusCode).toBe(200);
  });
});

// ============================================
// T-B-04: POST /campaigns/:id/recharge
// ============================================
describe('T-B-04: POST /api/v1/campaigns/:id/recharge', () => {
  it('✅ إعادة شحن ناجح', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id)
    );

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign._id}/recharge`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.amountAdded).toBe(100);
  });

  it('❌ رصيد غير كافي: 400', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id)
    );

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign._id}/recharge`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 99999 });

    expect(res.statusCode).toBe(400);
  });

  it('❌ حملة معلن تاني: 403', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(otherBrandUser._id)
    );

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign._id}/recharge`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ amount: 100 });

    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-04: PUT /campaigns/:id/pause
// ============================================
describe('T-B-04: PUT /api/v1/campaigns/:id/pause', () => {
  it('✅ إيقاف حملة يدوي', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, { status: 'ACTIVE' })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/pause`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('MANUALLY_PAUSED');
  });

  it('❌ حملة موقوفة أصلاً: 400', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, { status: 'MANUALLY_PAUSED' })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/pause`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(400);
  });

  it('❌ حملة معلن تاني: 403', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(otherBrandUser._id, { status: 'ACTIVE' })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/pause`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-04: PUT /campaigns/:id/resume
// ============================================
describe('T-B-04: PUT /api/v1/campaigns/:id/resume', () => {
  it('✅ استئناف حملة موقوفة', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, {
        status: 'MANUALLY_PAUSED',
        remainingBudget: 100,
      })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/resume`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('❌ remainingBudget = 0 → INSUFFICIENT_BALANCE', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, {
        status: 'MANUALLY_PAUSED',
        remainingBudget: 0,
      })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/resume`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
  });

  it('❌ حملة نشطة أصلاً: 400', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id, { status: 'ACTIVE' })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/resume`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(400);
  });

  it('❌ حملة معلن تاني: 403', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(otherBrandUser._id, {
        status: 'MANUALLY_PAUSED',
        remainingBudget: 100,
      })
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/resume`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-04: PUT /campaigns/:id/auto-resume
// ============================================
describe('T-B-04: PUT /api/v1/campaigns/:id/auto-resume', () => {
  it('✅ تعيين auto-resume = true', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id)
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/auto-resume`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ autoResumeOnRecharge: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.autoResumeOnRecharge).toBe(true);
  });

  it('❌ حملة معلن تاني: 403', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(otherBrandUser._id)
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/auto-resume`)
      .set('Authorization', `Bearer ${brandToken}`)
      .send({ autoResumeOnRecharge: true });

    expect(res.statusCode).toBe(403);
  });
});

// ============================================
// T-B-04: PUT /campaigns/:id/auto-recharge (Stub)
// ============================================
describe('T-B-04: PUT /api/v1/campaigns/:id/auto-recharge', () => {
  it('✅ يرجع 501 NOT_IMPLEMENTED', async () => {
    const campaign = await Campaign.create(
      validCampaignPayload(brandUser._id)
    );

    const res = await request(app)
      .put(`/api/v1/campaigns/${campaign._id}/auto-recharge`)
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.statusCode).toBe(501);
    expect(res.body.code).toBe('NOT_IMPLEMENTED');
  });
});