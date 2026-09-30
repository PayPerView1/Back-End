const mongoose = require('mongoose');
const { WALLET_CONSTRAINTS } = require('../constants/payment.constants');

const platformLedgerSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true,
      index: true,
    },
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: WALLET_CONSTRAINTS.DEFAULT_CURRENCY,
      uppercase: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    // للقراءة فقط — لا حاجة لـ updatedAt
  }
);

module.exports = mongoose.model('PlatformLedger', platformLedgerSchema);