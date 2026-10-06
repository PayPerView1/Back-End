// src/models/transaction.js
const mongoose = require('mongoose');
const {
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  PAYMENT_METHOD,
  WALLET_CONSTRAINTS,
} = require('../constants/payment.constants');

const transactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
      // المبلغ الذي دفعه المعلن قبل اقتطاع العمولة
    },
    commission: {
      type: Number,
      default: 0,
      min: 0,
      // العمولة المقتطعة لصالح المنصة
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
      // المبلغ المُضاف/المُخصوم فعلياً من المحفظة = grossAmount - commission
    },
    currency: {
      type: String,
      default: WALLET_CONSTRAINTS.DEFAULT_CURRENCY,
      uppercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      required: false,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
      index: true,
    },
    referenceId: {
      type: String,
      unique: true,
      sparse: true,
      // معرّف الطلب لدى البوابة: PayPal order ID أو Moyasar invoice ID
      // لا يُستبدل بعد الإنشاء، ويُستخدم للربط (مثلاً في /paypal/capture)
      // sparse: التحويل البنكي اليدوي ليس له reference من بوابة
    },
    captureId: {
      type: String,
      unique: true,
      sparse: true,
      // معرّف الدفعة الفعلية: PayPal capture ID أو Moyasar payment ID
      // UNIQUE لضمان ألا تُحتسب نفس الدفعة على أكثر من transaction
    },
    description: {
      type: String,
      default: '',
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
      // يُملأ فقط عند DEBIT (تخصيص ميزانية لحملة)
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1, type: 1 });
transactionSchema.index({ walletId: 1, status: 1 });
// لتنظيف الـ transactions المعلّقة القديمة (cancelStalePendingTransactions)
transactionSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);