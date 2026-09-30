// src/services/wallet/walletRefund.service.js

const mongoose = require('mongoose');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const RefundRequest = require('../../models/refundRequest');
const { calculateFreeBalance } = require('../../utils/wallet/freeBalance.utils');
const {
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  REFUND_STATUS,
  WALLET_CONSTRAINTS,
} = require('../../constants/payment.constants');
const {
  sendRefundSubmittedEmail,
  sendRefundApprovedEmail,
  sendRefundRejectedEmail,
  sendRefundCancelledEmail,
} = require('../emailService');

// ----------------------
// 1. تقديم طلب استرداد
// ----------------------
const submitRefundRequest = async (advertiserId, amount) => {
  // التحقق من الحد الأدنى
  if (amount < WALLET_CONSTRAINTS.MIN_REFUND) {
    const error = new Error(`Minimum refund amount is $${WALLET_CONSTRAINTS.MIN_REFUND}`);
    error.code = 'AMOUNT_TOO_LOW';
    throw error;
  }

  const wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) {
    const error = new Error('Wallet not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  // حساب الرصيد الحر
  const { freeBalance, reservedBalance } = await calculateFreeBalance(wallet._id);

  if (amount > freeBalance) {
    // التحقق من سبب عدم كفاية الرصيد
    if (reservedBalance > 0) {
      const error = new Error(
        'You have active campaigns with allocated budget. Please pause campaigns before requesting a refund.'
      );
      error.code = 'ACTIVE_CAMPAIGN_EXISTS';
      throw error;
    }

    const error = new Error(
      `Requested amount exceeds available balance. Available: $${freeBalance.toFixed(2)}`
    );
    error.code = 'INSUFFICIENT_BALANCE';
    throw error;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // خصم المبلغ من المحفظة فوراً (hold)
    await Wallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: -amount } },
      { session }
    );

    // إنشاء REFUND transaction بحالة PENDING
    const transaction = await Transaction.create(
      [
        {
          walletId: wallet._id,
          type: TRANSACTION_TYPE.REFUND,
          grossAmount: amount,
          commission: 0,
          netAmount: amount,
          currency: 'USD',
          paymentMethod: wallet.lastPaymentMethod || null,
          status: TRANSACTION_STATUS.PENDING,
          description: 'Refund request submitted',
        },
      ],
      { session }
    );

    // إنشاء refund_request
    const refundRequest = await RefundRequest.create(
      [
        {
          walletId: wallet._id,
          transactionId: transaction[0]._id,
          amount,
          fee: 0,
          netAmount: amount,
          refundMethod: wallet.lastPaymentMethod || 'PAYPAL',
          status: REFUND_STATUS.PENDING,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // إرسال إيميل تأكيد
    const advertiser = await mongoose.model('User').findById(advertiserId);
    await sendRefundSubmittedEmail(advertiser, {
      amount,
      refundRequestId: refundRequest[0]._id,
    });

    const updatedWallet = await Wallet.findById(wallet._id);

    return {
      refundRequestId: refundRequest[0]._id,
      transactionId: transaction[0]._id,
      amount,
      fee: 0,
      netAmount: amount,
      refundMethod: refundRequest[0].refundMethod,
      status: REFUND_STATUS.PENDING,
      walletBalanceAfter: updatedWallet.balance,
      message: 'Refund request submitted. It will be reviewed within 24–48 hours.',
      createdAt: refundRequest[0].createdAt,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ----------------------
// 2. إلغاء طلب الاسترداد (فقط إذا كان PENDING)
// ----------------------
const cancelRefundRequest = async (refundRequestId, advertiserId) => {
  const wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) {
    const error = new Error('Wallet not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const refundRequest = await RefundRequest.findOne({
    _id: refundRequestId,
    walletId: wallet._id,
  });

  if (!refundRequest) {
    const error = new Error('Refund request not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (refundRequest.status !== REFUND_STATUS.PENDING) {
    const error = new Error('This refund request can no longer be cancelled.');
    error.code = 'REFUND_NOT_CANCELLABLE';
    throw error;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // إعادة المبلغ للمحفظة
    await Wallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: refundRequest.amount } },
      { session }
    );

    // تحديث حالة الطلب
    await RefundRequest.findByIdAndUpdate(
      refundRequestId,
      { status: REFUND_STATUS.CANCELLED },
      { session }
    );

    // تحديث الـ transaction
    await Transaction.findByIdAndUpdate(
      refundRequest.transactionId,
      { status: TRANSACTION_STATUS.CANCELLED },
      { session }
    );

    await session.commitTransaction();

    const updatedWallet = await Wallet.findById(wallet._id);
    const advertiser = await mongoose.model('User').findById(advertiserId);

    await sendRefundCancelledEmail(advertiser, { amount: refundRequest.amount });

    return {
      refundRequestId,
      status: REFUND_STATUS.CANCELLED,
      walletBalanceAfter: updatedWallet.balance,
      message: 'Refund request cancelled. Amount returned to your wallet.',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ----------------------
// 3. جلب طلبات الاسترداد الخاصة بالمعلن
// ----------------------
const getRefundRequests = async (walletId, pagination = {}) => {
  const page = parseInt(pagination.page) || 1;
  const perPage = Math.min(parseInt(pagination.perPage) || 20, 100);

  const [refundRequests, total] = await Promise.all([
    RefundRequest.find({ walletId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage),
    RefundRequest.countDocuments({ walletId }),
  ]);

  return {
    data: refundRequests.map((r) => ({
      id: r._id,
      amount: r.amount,
      fee: r.fee,
      netAmount: r.netAmount,
      refundMethod: r.refundMethod,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

// ----------------------
// 4. موافقة الأدمن على طلب الاسترداد
// ----------------------
const approveRefund = async (refundRequestId, adminId, note) => {
  const refundRequest = await RefundRequest.findById(refundRequestId);

  if (!refundRequest) {
    const error = new Error('Refund request not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (refundRequest.status !== REFUND_STATUS.PENDING) {
    const error = new Error('Refund already processed');
    error.code = 'REFUND_NOT_CANCELLABLE';
    throw error;
  }

  await RefundRequest.findByIdAndUpdate(refundRequestId, {
    status: REFUND_STATUS.APPROVED,
    reviewedBy: adminId,
    reviewedAt: new Date(),
    ...(note && { rejectionNote: note }),
  });

  await Transaction.findByIdAndUpdate(refundRequest.transactionId, {
    status: TRANSACTION_STATUS.COMPLETED,
  });

  const wallet = await Wallet.findById(refundRequest.walletId);
  const advertiser = await mongoose.model('User').findById(wallet.advertiserId);

  await sendRefundApprovedEmail(advertiser, {
    amount: refundRequest.amount,
    netAmount: refundRequest.netAmount,
    refundMethod: refundRequest.refundMethod,
  });

  return {
    refundRequestId,
    action: 'APPROVED',
    amount: refundRequest.amount,
    netAmount: refundRequest.netAmount,
    refundMethod: refundRequest.refundMethod,
    status: REFUND_STATUS.APPROVED,
    message: 'Refund approved. Funds will be returned within gateway processing time.',
  };
};

// ----------------------
// 5. رفض الأدمن لطلب الاسترداد
// ----------------------
const rejectRefund = async (refundRequestId, adminId, note) => {
  const refundRequest = await RefundRequest.findById(refundRequestId);

  if (!refundRequest) {
    const error = new Error('Refund request not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (refundRequest.status !== REFUND_STATUS.PENDING) {
    const error = new Error('Refund already processed');
    error.code = 'REFUND_NOT_CANCELLABLE';
    throw error;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // إعادة المبلغ المحجوز للمحفظة
    await Wallet.findByIdAndUpdate(
      refundRequest.walletId,
      { $inc: { balance: refundRequest.amount } },
      { session }
    );

    await RefundRequest.findByIdAndUpdate(
      refundRequestId,
      {
        status: REFUND_STATUS.REJECTED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionNote: note,
      },
      { session }
    );

    await Transaction.findByIdAndUpdate(
      refundRequest.transactionId,
      { status: TRANSACTION_STATUS.FAILED },
      { session }
    );

    await session.commitTransaction();

    const updatedWallet = await Wallet.findById(refundRequest.walletId);
    const advertiser = await mongoose.model('User').findById(updatedWallet.advertiserId);

    await sendRefundRejectedEmail(advertiser, {
      amount: refundRequest.amount,
      note,
    });

    return {
      refundRequestId,
      action: 'REJECTED',
      note,
      status: REFUND_STATUS.REJECTED,
      walletBalanceAfter: updatedWallet.balance,
      message: 'Refund rejected. Held amount returned to wallet.',
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  submitRefundRequest,
  cancelRefundRequest,
  getRefundRequests,
  approveRefund,
  rejectRefund,
};