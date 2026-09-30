const mongoose = require('mongoose');
const {
  REFUND_STATUS,
  PAYMENT_METHOD,
  WALLET_CONSTRAINTS,
} = require('../constants/payment.constants');

const refundRequestSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [WALLET_CONSTRAINTS.MIN_REFUND, `Minimum refund is $${WALLET_CONSTRAINTS.MIN_REFUND}`],
    },
    fee: {
      type: Number,
      default: 0,
      // صفر في MVP — الحقل موجود للمستقبل
    },
    netAmount: {
      type: Number,
      required: true,
      // = amount - fee (في MVP يساوي amount لأن fee = 0)
    },
    refundMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      required: true,
      // في MVP: نفس طريقة الدفع الأصلية دائماً
    },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUS),
      default: REFUND_STATUS.PENDING,
      index: true,
    },
    rejectionNote: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

refundRequestSchema.index({ walletId: 1, status: 1 });
refundRequestSchema.index({ walletId: 1, createdAt: -1 });

module.exports = mongoose.model('RefundRequest', refundRequestSchema);