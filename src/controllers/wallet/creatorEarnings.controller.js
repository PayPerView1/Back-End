const creatorEarningsService = require('../../services/wallet/creatorEarnings.service');
const creatorEarningsPredictionService = require('../../services/wallet/creatorEarningsPrediction.service');
const creatorPaymentMethodService = require('../../services/wallet/creatorPaymentMethod.service');
const { AppError, sendError } = require('../../utils/errors');
const CreatorPaymentMethod = require('../../models/CreatorPaymentMethod');
const WithdrawalRequest = require('../../models/WithdrawalRequest');
const aiIntelligence = require('../../services/ai/aiIntelligence.client');
const { parsePaymentMethodsByCountry } = require('../../services/ai/paymentMethodsByCountry');

const getWallet = async (req, res) => {
  try {
    const data = await creatorEarningsService.getWalletSummary(req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.getWallet');
  }
};

const listEarnings = async (req, res) => {
  try {
    const data = await creatorEarningsService.listEarnings(req.user._id, req.validated.query);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.listEarnings');
  }
};

const getEarningsPrediction = async (req, res) => {
  try {
    const data = await creatorEarningsPredictionService.getCreatorEarningsPrediction(req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.getEarningsPrediction');
  }
};

const listPaymentMethods = async (req, res) => {
  try {
    const data = await creatorPaymentMethodService.listPaymentMethods(req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.listPaymentMethods');
  }
};

const addPaymentMethod = async (req, res) => {
  try {
    const data = await creatorPaymentMethodService.addPaymentMethod(req.user._id, req.validated.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.addPaymentMethod');
  }
};

const removePaymentMethod = async (req, res) => {
  try {
    const data = await creatorPaymentMethodService.removePaymentMethod(req.user._id, req.validated.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.removePaymentMethod');
  }
};

const requestWithdrawal = async (req, res) => {
  try {
    const data = await creatorEarningsService.requestWithdrawal(req.user._id, req.validated.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.requestWithdrawal');
  }
};

const listWithdrawals = async (req, res) => {
  try {
    const data = await creatorEarningsService.listWithdrawals(req.user._id, req.validated.query);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.listWithdrawals');
  }
};

const analyzeWithdrawalIntelligence = async (req, res) => {
  try {
    const creatorId = req.user._id;
    let candidate = null;
    if (req.validated.body.paymentMethodId) {
      const candidateMethod = await CreatorPaymentMethod.findOne({
        _id: req.validated.body.paymentMethodId,
        creatorId,
        isActive: true,
      }).select('type').lean();
      if (!candidateMethod) throw new AppError('Payment method not found', 'NOT_FOUND');
      candidate = {
        ...(Number.isFinite(req.validated.body.amount) ? { amountCents: Math.round(req.validated.body.amount * 100) } : {}),
        method: candidateMethod.type,
      };
    } else if (Number.isFinite(req.validated.body.amount)) {
      candidate = { amountCents: Math.round(req.validated.body.amount * 100) };
    }

    const [withdrawals, methods] = await Promise.all([
      WithdrawalRequest.find({ creatorId }).sort({ createdAt: -1 }).limit(500)
        .select('amountCents status createdAt completedAt paymentMethodId')
        .populate('paymentMethodId', 'type').lean(),
      CreatorPaymentMethod.find({ creatorId, isActive: true }).select('type').lean(),
    ]);
    const data = await aiIntelligence.analyzeWithdrawals({
      country: req.user.country || null,
      candidate,
      availableMethods: [...new Set(methods.map((method) => method.type))],
      paymentMethodsByCountry: parsePaymentMethodsByCountry(),
      withdrawals: withdrawals.map((item) => ({
        amountCents: item.amountCents,
        status: item.status,
        method: item.paymentMethodId?.type || null,
        createdAt: item.createdAt?.toISOString?.() || null,
        completedAt: item.completedAt?.toISOString?.() || null,
      })),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.analyzeWithdrawalIntelligence');
  }
};

const listAdminWithdrawals = async (req, res) => {
  try {
    const data = await creatorEarningsService.listAdminWithdrawals(req.validated.query);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.listAdminWithdrawals');
  }
};

const processWithdrawal = async (req, res) => {
  try {
    const data = await creatorEarningsService.processWithdrawal(
      req.validated.params.id,
      req.user._id,
      req.validated.body
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'creatorEarnings.processWithdrawal');
  }
};

module.exports = {
  getWallet,
  listEarnings,
  getEarningsPrediction,
  listPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  requestWithdrawal,
  listWithdrawals,
  analyzeWithdrawalIntelligence,
  listAdminWithdrawals,
  processWithdrawal,
};
