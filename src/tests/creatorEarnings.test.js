require('dotenv').config();

const db = require('./helpers/db');
const f = require('./helpers/factories');
const CreatorWallet = require('../models/CreatorWallet');
const CreatorEarning = require('../models/CreatorEarning');
const CreatorPaymentMethod = require('../models/CreatorPaymentMethod');
const WithdrawalRequest = require('../models/WithdrawalRequest');

jest.mock('../services/notification/notification.service', () => ({
  notifyUser: jest.fn().mockResolvedValue(null),
}));

const paymentMethods = require('../services/wallet/creatorPaymentMethod.service');
const earnings = require('../services/wallet/creatorEarnings.service');

jest.setTimeout(120000);
beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(() => {
  process.env.PAYMENT_DETAILS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
  delete process.env.PAYMENT_DETAILS_ENCRYPTION_KEY;
});

const addMethod = (creatorId) => paymentMethods.addPaymentMethod(creatorId, {
  type: 'PAYPAL',
  label: 'Primary PayPal',
  details: { accountName: 'Creator', accountIdentifier: 'creator@example.com', bankName: '' },
  isDefault: true,
});

test('reserves ledger-backed balance and releases it exactly once after failed manual payout', async () => {
  const creator = await f.createUser();
  const method = await addMethod(creator._id);
  const brand = await f.createBrand();
  const campaign = await f.createCampaign(brand);
  const application = await f.createAcceptedApplication(creator, campaign);
  const submission = await f.createSubmission({ creator, campaign, application }, { status: 'APPROVED' });
  const wallet = await CreatorWallet.create({ creatorId: creator._id, availableBalanceCents: 2500, totalEarningsCents: 2500 });
  const earning = await CreatorEarning.create({
    creatorId: creator._id,
    campaignId: campaign._id,
    submissionId: submission._id,
    snapshotId: new (require('mongoose').Types.ObjectId)(),
    views: 5000,
    grossAmountCents: 2500,
    commissionCents: 0,
    netAmountCents: 2500,
    status: 'AVAILABLE',
    availableAt: new Date(),
    unreservedAmountCents: 2500,
  });

  const withdrawal = await earnings.requestWithdrawal(creator._id, { amount: 20, paymentMethodId: method.id });
  expect(withdrawal.status).toBe('PENDING');
  expect(withdrawal.paymentMethod).toMatchObject({
    id: method.id,
    type: 'PAYPAL',
    label: 'Primary PayPal',
    last4: 'ECOM',
  });
  let savedWallet = await CreatorWallet.findById(wallet._id);
  expect(savedWallet.availableBalanceCents).toBe(500);
  expect(savedWallet.reservedBalanceCents).toBe(2000);
  let savedEarning = await CreatorEarning.findById(earning._id);
  expect(savedEarning.unreservedAmountCents).toBe(500);
  expect(savedEarning.reservedAmountCents).toBe(2000);

  const processed = await earnings.processWithdrawal(withdrawal.id, (await f.createAdmin())._id, { decision: 'PROCESS' });
  expect(processed.paymentMethod).toMatchObject({ id: method.id, type: 'PAYPAL' });
  await earnings.processWithdrawal(withdrawal.id, (await f.createAdmin())._id, {
    decision: 'FAIL',
    note: 'Provider rejected the manual transfer',
  });
  savedWallet = await CreatorWallet.findById(wallet._id);
  savedEarning = await CreatorEarning.findById(earning._id);
  expect(savedWallet.availableBalanceCents).toBe(2500);
  expect(savedWallet.reservedBalanceCents).toBe(0);
  expect(savedEarning.unreservedAmountCents).toBe(2500);
  expect(savedEarning.reservedAmountCents).toBe(0);
  expect(await WithdrawalRequest.countDocuments({ status: 'FAILED' })).toBe(1);
  expect((await CreatorPaymentMethod.findById(method.id)).pendingWithdrawals).toBe(0);
});

test('rejects a request below the configured minimum before reserving funds', async () => {
  const creator = await f.createUser();
  const method = await addMethod(creator._id);
  await CreatorWallet.create({ creatorId: creator._id, availableBalanceCents: 10000 });

  await expect(earnings.requestWithdrawal(creator._id, { amount: 9.99, paymentMethodId: method.id }))
    .rejects.toMatchObject({ code: 'WITHDRAWAL_MINIMUM_NOT_MET' });
  expect((await CreatorWallet.findOne({ creatorId: creator._id })).availableBalanceCents).toBe(10000);
});

test('refuses duplicate active payment method records and does not expose encrypted detail fields', async () => {
  const creator = await f.createUser();
  const method = await addMethod(creator._id);
  await expect(addMethod(creator._id)).rejects.toMatchObject({ code: 'PAYMENT_METHOD_EXISTS' });
  const listed = await paymentMethods.listPaymentMethods(creator._id);

  expect(listed).toHaveLength(1);
  expect(listed[0].last4).toBe('ECOM');
  expect(listed[0]).not.toHaveProperty('details');
  expect(await CreatorPaymentMethod.countDocuments({ creatorId: creator._id })).toBe(1);
  expect(method.isDefault).toBe(true);
});
