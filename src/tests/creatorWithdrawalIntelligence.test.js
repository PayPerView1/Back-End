jest.mock('../models/CreatorPaymentMethod', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/WithdrawalRequest', () => ({ find: jest.fn() }));
jest.mock('../services/ai/aiIntelligence.client', () => ({ analyzeWithdrawals: jest.fn() }));

const CreatorPaymentMethod = require('../models/CreatorPaymentMethod');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const aiIntelligence = require('../services/ai/aiIntelligence.client');
const controller = require('../controllers/wallet/creatorEarnings.controller');

const query = (result) => {
  const value = {
    sort: jest.fn(() => value), limit: jest.fn(() => value), select: jest.fn(() => value),
    populate: jest.fn(() => value), lean: jest.fn().mockResolvedValue(result),
  };
  return value;
};
const response = () => {
  const result = { status: jest.fn(), json: jest.fn() };
  result.status.mockReturnValue(result);
  return result;
};

describe('creator withdrawal intelligence account isolation', () => {
  const originalConfig = process.env.PAYMENT_METHODS_BY_COUNTRY;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYMENT_METHODS_BY_COUNTRY = '{"JO":["PAYPAL","BANK_TRANSFER"]}';
    CreatorPaymentMethod.findOne.mockReturnValue(query({ type: 'PAYPAL' }));
    CreatorPaymentMethod.find.mockReturnValue(query([{ type: 'PAYPAL' }]));
    WithdrawalRequest.find.mockReturnValue(query([{
      amountCents: 5000, status: 'COMPLETED', createdAt: new Date('2026-10-01T00:00:00Z'),
      completedAt: new Date('2026-10-01T04:00:00Z'), paymentMethodId: { type: 'PAYPAL' },
    }]));
    aiIntelligence.analyzeWithdrawals.mockResolvedValue({ risk: 'LOW' });
  });
  afterAll(() => {
    if (originalConfig === undefined) delete process.env.PAYMENT_METHODS_BY_COUNTRY;
    else process.env.PAYMENT_METHODS_BY_COUNTRY = originalConfig;
  });

  test('only forwards the authenticated creator’s withdrawals and owned active methods', async () => {
    const req = { user: { _id: 'creator-a', country: 'JO' }, validated: { body: { amount: 50, paymentMethodId: 'method-a' } } };
    const res = response();
    await controller.analyzeWithdrawalIntelligence(req, res);

    expect(CreatorPaymentMethod.findOne).toHaveBeenCalledWith({ _id: 'method-a', creatorId: 'creator-a', isActive: true });
    expect(WithdrawalRequest.find).toHaveBeenCalledWith({ creatorId: 'creator-a' });
    expect(aiIntelligence.analyzeWithdrawals).toHaveBeenCalledWith(expect.objectContaining({
      candidate: { amountCents: 5000, method: 'PAYPAL' }, availableMethods: ['PAYPAL'],
      withdrawals: [expect.objectContaining({ amountCents: 5000, method: 'PAYPAL' })],
      paymentMethodsByCountry: { JO: ['PAYPAL', 'BANK_TRANSFER'] },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not analyze a payment method owned by another creator', async () => {
    CreatorPaymentMethod.findOne.mockReturnValue(query(null));
    const res = response();
    await controller.analyzeWithdrawalIntelligence({ user: { _id: 'creator-a' }, validated: { body: { paymentMethodId: 'foreign-method' } } }, res);
    expect(aiIntelligence.analyzeWithdrawals).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
