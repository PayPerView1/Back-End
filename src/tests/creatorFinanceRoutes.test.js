require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const db = require('./helpers/db');
const f = require('./helpers/factories');

jest.mock('../services/wallet/creatorEarnings.service', () => ({
  getWalletSummary: jest.fn(),
  listEarnings: jest.fn(),
  requestWithdrawal: jest.fn(),
  listWithdrawals: jest.fn(),
  listAdminWithdrawals: jest.fn(),
  processWithdrawal: jest.fn(),
}));
jest.mock('../services/wallet/creatorPaymentMethod.service', () => ({
  listPaymentMethods: jest.fn(),
  addPaymentMethod: jest.fn(),
  removePaymentMethod: jest.fn(),
}));

const earnings = require('../services/wallet/creatorEarnings.service');
const methods = require('../services/wallet/creatorPaymentMethod.service');
const app = require('../app');
const API = '/api/v1';
const id = () => new mongoose.Types.ObjectId().toString();

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});

test('creator earnings endpoints require an authenticated CLIPPER', async () => {
  expect((await request(app).get(`${API}/creator/earnings`)).status).toBe(401);
  const brand = await f.createBrand();
  const response = await request(app).get(`${API}/creator/earnings`).set(f.authHeader(brand));
  expect(response.status).toBe(403);
  expect(earnings.getWalletSummary).not.toHaveBeenCalled();
});

test('creator withdrawal validates and derives owner from the JWT', async () => {
  const creator = await f.createUser();
  earnings.requestWithdrawal.mockResolvedValue({ id: 'w-1', status: 'PENDING' });
  const paymentMethodId = id();
  const response = await request(app)
    .post(`${API}/creator/withdrawals`)
    .set(f.authHeader(creator))
    .send({ amount: 20, paymentMethodId, creatorId: id() });

  expect(response.status).toBe(201);
  expect(earnings.requestWithdrawal).toHaveBeenCalledWith(
    creator._id,
    { amount: 20, paymentMethodId }
  );
});

test('withdrawal admin queue is restricted to ADMIN', async () => {
  const brand = await f.createBrand();
  const response = await request(app).get(`${API}/admin/withdrawals`).set(f.authHeader(brand));
  expect(response.status).toBe(403);
  expect(earnings.listAdminWithdrawals).not.toHaveBeenCalled();
});

test('creator payment method input rejects plaintext extra fields', async () => {
  const creator = await f.createUser();
  const response = await request(app)
    .post(`${API}/creator/payment-methods`)
    .set(f.authHeader(creator))
    .send({
      type: 'PAYPAL',
      label: 'PayPal',
      details: { accountName: 'Creator', accountIdentifier: 'pay@example.com', bankName: '', cvv: '123' },
    });

  expect(response.status).toBe(400);
  expect(methods.addPaymentMethod).not.toHaveBeenCalled();
});
