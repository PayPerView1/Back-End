const mongoose = require('mongoose');
const CreatorWallet = require('../../models/CreatorWallet');
const CreatorEarning = require('../../models/CreatorEarning');
const CreatorPaymentMethod = require('../../models/CreatorPaymentMethod');
const WithdrawalRequest = require('../../models/WithdrawalRequest');
const { AppError } = require('../../utils/errors');
const { NOTIFICATION_TYPE } = require('../../constants/discovery.constants');
const { notifyUser } = require('../notification/notification.service');
const { buildNotification } = require('../notification/notification.templates');
const { decryptDetails } = require('./paymentDetailsCrypto.service');

const cents = (amount) => Math.round(Number(amount) * 100);
const dollars = (amountCents) => amountCents / 100;
const MIN_WITHDRAWAL = Math.max(0, Number(process.env.MIN_CREATOR_WITHDRAWAL_USD) || 10);

const withdrawalDto = (item) => ({
  id: item._id,
  amount: dollars(item.amountCents),
  currency: item.currency,
  status: item.status,
  paymentMethod: item.paymentMethodId ? {
    id: item.paymentMethodId._id,
    type: item.paymentMethodId.type,
    label: item.paymentMethodId.label,
    last4: item.paymentMethodId.last4,
  } : null,
  note: item.note || '',
  externalReference: item.externalReference || '',
  createdAt: item.createdAt,
  processedAt: item.processedAt,
  completedAt: item.completedAt,
  failedAt: item.failedAt,
});

const loadWithdrawalDto = async (withdrawalId) => {
  const withdrawal = await WithdrawalRequest.findById(withdrawalId)
    .populate('paymentMethodId', 'type label last4')
    .lean();
  if (!withdrawal) throw new AppError('Withdrawal request not found', 'NOT_FOUND');
  return withdrawalDto(withdrawal);
};

const getWalletSummary = async (creatorId) => {
  const [wallet, totals, earningSubmissions] = await Promise.all([
    CreatorWallet.findOne({ creatorId }).lean(),
    CreatorEarning.aggregate([
      { $match: { creatorId: new mongoose.Types.ObjectId(String(creatorId)) } },
      { $group: { _id: null, totalViews: { $sum: '$views' }, earningRecords: { $sum: 1 } } },
    ]),
    CreatorEarning.distinct('submissionId', { creatorId }),
  ]);
  return {
    creatorId,
    currency: wallet?.currency || 'USD',
    availableBalance: dollars(wallet?.availableBalanceCents || 0),
    pendingBalance: dollars(wallet?.pendingBalanceCents || 0),
    reservedBalance: dollars(wallet?.reservedBalanceCents || 0),
    totalEarnings: dollars(wallet?.totalEarningsCents || 0),
    totalWithdrawn: dollars(wallet?.totalWithdrawnCents || 0),
    totalViews: Number(totals[0]?.totalViews || 0),
    earningRecords: Number(totals[0]?.earningRecords || 0),
    earningSubmissions: earningSubmissions.length,
  };
};

const listEarnings = async (creatorId, { page = 1, perPage = 20 } = {}) => {
  const skip = (page - 1) * perPage;
  const [data, total] = await Promise.all([
    CreatorEarning.find({ creatorId })
      .populate('campaignId', 'name')
      .populate('submissionId', 'platform postMeta.caption canonicalUrl')
      .sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    CreatorEarning.countDocuments({ creatorId }),
  ]);
  return {
    data: data.map((item) => {
      const {
        grossAmountCents,
        commissionCents,
        netAmountCents,
        unreservedAmountCents,
        reservedAmountCents,
        paidAmountCents,
        ...publicFields
      } = item;
      return {
        ...publicFields,
        campaignId: item.campaignId?._id || item.campaignId,
        campaignName: item.campaignId?.name || '',
        submissionId: item.submissionId?._id || item.submissionId,
        platform: item.submissionId?.platform || '',
        postTitle: item.submissionId?.postMeta?.caption || '',
        postUrl: item.submissionId?.canonicalUrl || '',
        grossAmount: dollars(grossAmountCents),
        commission: dollars(commissionCents),
        netAmount: dollars(netAmountCents),
        unreservedAmount: dollars(unreservedAmountCents),
        reservedAmount: dollars(reservedAmountCents),
        paidAmount: dollars(paidAmountCents),
      };
    }),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  };
};

const requestWithdrawal = async (creatorId, { amount, paymentMethodId }) => {
  const amountCents = cents(amount);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new AppError('Withdrawal amount must be a positive amount with at most two decimals', 'VALIDATION_ERROR');
  }
  if (amountCents < cents(MIN_WITHDRAWAL)) {
    throw new AppError(`Minimum withdrawal amount is ${MIN_WITHDRAWAL} USD`, 'WITHDRAWAL_MINIMUM_NOT_MET');
  }
  if (!mongoose.Types.ObjectId.isValid(paymentMethodId)) {
    throw new AppError('Payment method not found', 'NOT_FOUND');
  }

  const session = await mongoose.startSession();
  let withdrawal;
  try {
    await session.withTransaction(async () => {
      const method = await CreatorPaymentMethod.findOne({
        _id: paymentMethodId,
        creatorId,
        isActive: true,
      }).session(session);
      if (!method) throw new AppError('Payment method not found', 'NOT_FOUND');
      const methodReservation = await CreatorPaymentMethod.updateOne(
        { _id: method._id, creatorId, isActive: true },
        { $inc: { pendingWithdrawals: 1 } },
        { session }
      );
      if (methodReservation.modifiedCount !== 1) {
        throw new AppError('Payment method is no longer available', 'PAYMENT_METHOD_IN_USE');
      }

      let wallet = await CreatorWallet.findOne({ creatorId }).session(session);
      if (!wallet) {
        [wallet] = await CreatorWallet.create([{ creatorId, currency: 'USD' }], { session });
      }
      const walletUpdate = await CreatorWallet.updateOne(
        { _id: wallet._id, availableBalanceCents: { $gte: amountCents } },
        {
          $inc: {
            availableBalanceCents: -amountCents,
            reservedBalanceCents: amountCents,
          },
        },
        { session }
      );
      if (walletUpdate.modifiedCount !== 1) {
        throw new AppError('Available earnings are insufficient for this withdrawal', 'INSUFFICIENT_EARNINGS');
      }

      const earnings = await CreatorEarning.find({
        creatorId,
        status: { $in: ['AVAILABLE', 'PARTIALLY_RESERVED'] },
        unreservedAmountCents: { $gt: 0 },
      }).sort({ createdAt: 1, _id: 1 }).session(session);
      let remainingCents = amountCents;
      const allocations = [];
      for (const earning of earnings) {
        if (remainingCents <= 0) break;
        const availableCents = earning.unreservedAmountCents;
        const allocatedCents = Math.min(remainingCents, availableCents);
        if (!allocatedCents) continue;
        const nextUnreserved = availableCents - allocatedCents;
        const status = nextUnreserved > 0 ? 'PARTIALLY_RESERVED' : 'RESERVED';
        const result = await CreatorEarning.updateOne(
          { _id: earning._id, unreservedAmountCents: { $gte: allocatedCents } },
          {
            $inc: {
              unreservedAmountCents: -allocatedCents,
              reservedAmountCents: allocatedCents,
            },
            $set: { status },
          },
          { session }
        );
        if (result.modifiedCount !== 1) throw new AppError('Earnings changed while reserving the withdrawal', 'CONFLICT');
        allocations.push({ earningId: earning._id, amountCents: allocatedCents });
        remainingCents -= allocatedCents;
      }
      if (remainingCents !== 0) {
        throw new AppError('Earnings ledger does not match the available balance', 'INTERNAL_ERROR');
      }

      [withdrawal] = await WithdrawalRequest.create([{
        creatorId,
        paymentMethodId: method._id,
        amountCents,
        currency: wallet.currency,
        status: 'PENDING',
        earningAllocations: allocations,
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  await notifyUser(
    creatorId,
    buildNotification(NOTIFICATION_TYPE.WITHDRAWAL_STATUS, {
      amount: dollars(withdrawal.amountCents),
      status: withdrawal.status,
      currency: withdrawal.currency,
    }, { withdrawalId: String(withdrawal._id), status: withdrawal.status })
  );
  return loadWithdrawalDto(withdrawal._id);
};

const listWithdrawals = async (creatorId, { page = 1, perPage = 20 } = {}) => {
  const filter = { creatorId };
  const skip = (page - 1) * perPage;
  const [items, total] = await Promise.all([
    WithdrawalRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate('paymentMethodId', 'type label last4')
      .lean(),
    WithdrawalRequest.countDocuments(filter),
  ]);
  return {
    data: items.map(withdrawalDto),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  };
};

const listAdminWithdrawals = async ({ page = 1, perPage = 20, status } = {}) => {
  const filter = status ? { status } : {};
  const skip = (page - 1) * perPage;
  const [items, total] = await Promise.all([
    WithdrawalRequest.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(perPage)
      .populate('creatorId', 'fullName email')
      .populate({ path: 'paymentMethodId', select: 'type label last4 +details.keyVersion +details.iv +details.tag +details.ciphertext' })
      .lean(),
    WithdrawalRequest.countDocuments(filter),
  ]);
  return {
    data: items.map((item) => ({
      ...withdrawalDto(item),
      creator: item.creatorId ? { id: item.creatorId._id, fullName: item.creatorId.fullName, email: item.creatorId.email } : null,
      paymentDetails: item.paymentMethodId?.details ? decryptDetails(item.paymentMethodId.details) : null,
    })),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  };
};

const updateEarningAllocations = async (withdrawal, { pay, session }) => {
  for (const allocation of withdrawal.earningAllocations || []) {
    const earning = await CreatorEarning.findById(allocation.earningId).session(session);
    if (!earning || earning.reservedAmountCents < allocation.amountCents) {
      throw new AppError('Reserved earnings no longer match the withdrawal', 'INTERNAL_ERROR');
    }
    earning.reservedAmountCents -= allocation.amountCents;
    if (pay) {
      earning.paidAmountCents += allocation.amountCents;
    } else {
      earning.unreservedAmountCents += allocation.amountCents;
    }
    earning.status = earning.reservedAmountCents > 0
      ? (earning.unreservedAmountCents > 0 ? 'PARTIALLY_RESERVED' : 'RESERVED')
      : earning.unreservedAmountCents > 0 ? 'AVAILABLE' : 'PAID';
    await earning.save({ session });
  }
};

const processWithdrawal = async (withdrawalId, adminId, { decision, note = '', externalReference = '' }) => {
  if (!mongoose.Types.ObjectId.isValid(withdrawalId)) throw new AppError('Withdrawal not found', 'NOT_FOUND');
  if (decision === 'COMPLETE' && !externalReference.trim()) {
    throw new AppError('External payment reference is required to complete a manual payout', 'VALIDATION_ERROR');
  }

  const now = new Date();
  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
      if (!withdrawal) throw new AppError('Withdrawal not found', 'NOT_FOUND');

      if (decision === 'PROCESS') {
        if (withdrawal.status !== 'PENDING') throw new AppError('Withdrawal is not pending', 'WITHDRAWAL_NOT_PROCESSABLE');
        withdrawal.status = 'PROCESSING';
        withdrawal.reviewedBy = adminId;
        withdrawal.processedAt = now;
        withdrawal.note = note;
        await withdrawal.save({ session });
      } else if (decision === 'COMPLETE' || decision === 'FAIL') {
        if (withdrawal.status !== 'PROCESSING') throw new AppError('Withdrawal is not being processed', 'WITHDRAWAL_NOT_PROCESSABLE');
        const wallet = await CreatorWallet.findOne({ creatorId: withdrawal.creatorId }).session(session);
        if (!wallet || wallet.reservedBalanceCents < withdrawal.amountCents) {
          throw new AppError('Reserved wallet balance does not match the withdrawal', 'INTERNAL_ERROR');
        }
        if (decision === 'COMPLETE') {
          wallet.reservedBalanceCents -= withdrawal.amountCents;
          wallet.totalWithdrawnCents += withdrawal.amountCents;
          withdrawal.status = 'COMPLETED';
          withdrawal.externalReference = externalReference.trim();
          withdrawal.completedAt = now;
        } else {
          wallet.reservedBalanceCents -= withdrawal.amountCents;
          wallet.availableBalanceCents += withdrawal.amountCents;
          withdrawal.status = 'FAILED';
          withdrawal.failedAt = now;
        }
        wallet.updatedAt = now;
        await wallet.save({ session });
        await updateEarningAllocations(withdrawal, { pay: decision === 'COMPLETE', session });
        const methodUpdate = await CreatorPaymentMethod.updateOne(
          { _id: withdrawal.paymentMethodId, pendingWithdrawals: { $gt: 0 } },
          { $inc: { pendingWithdrawals: -1 } },
          { session }
        );
        if (methodUpdate.modifiedCount !== 1) {
          throw new AppError('Payment method withdrawal counter is inconsistent', 'INTERNAL_ERROR');
        }
        withdrawal.reviewedBy = adminId;
        withdrawal.note = note;
        await withdrawal.save({ session });
      } else {
        throw new AppError('Invalid withdrawal decision', 'VALIDATION_ERROR');
      }
      updated = withdrawal;
    });
  } finally {
    await session.endSession();
  }

  await notifyUser(
    updated.creatorId,
    buildNotification(NOTIFICATION_TYPE.WITHDRAWAL_STATUS, {
      amount: dollars(updated.amountCents),
      status: updated.status,
      currency: updated.currency,
    }, { withdrawalId: String(updated._id), status: updated.status })
  );
  return loadWithdrawalDto(updated._id);
};

const releaseDueEarnings = async (now = new Date(), limit = 100) => {
  const due = await CreatorEarning.find({ status: 'ON_HOLD', availableAt: { $lte: now } })
    .sort({ availableAt: 1 })
    .limit(limit)
    .select('_id creatorId netAmountCents availableAt')
    .lean();
  let released = 0;

  for (const item of due) {
    const session = await mongoose.startSession();
    let didRelease = false;
    try {
      await session.withTransaction(async () => {
        didRelease = false;
        const earning = await CreatorEarning.findOneAndUpdate(
          { _id: item._id, status: 'ON_HOLD', availableAt: { $lte: now } },
          { $set: { status: 'AVAILABLE', unreservedAmountCents: item.netAmountCents } },
          { new: true, session }
        );
        if (!earning) return;
        const wallet = await CreatorWallet.updateOne(
          { creatorId: item.creatorId, pendingBalanceCents: { $gte: item.netAmountCents } },
          { $inc: { pendingBalanceCents: -item.netAmountCents, availableBalanceCents: item.netAmountCents } },
          { session }
        );
        if (wallet.modifiedCount !== 1) throw new AppError('Pending wallet balance does not match its ledger', 'INTERNAL_ERROR');
        didRelease = true;
      });
    } finally {
      await session.endSession();
    }
    if (didRelease) released += 1;
  }
  return { processed: due.length, released };
};

module.exports = {
  getWalletSummary,
  listEarnings,
  requestWithdrawal,
  listWithdrawals,
  listAdminWithdrawals,
  processWithdrawal,
  releaseDueEarnings,
  MIN_WITHDRAWAL,
};
