const mongoose = require('mongoose');
const { WALLET_CONSTRAINTS } = require('../constants/payment.constants');

const walletSchema = new mongoose.Schema(
  {
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // كل معلن له محفظة واحدة فقط
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    currency: {
      type: String,
      default: WALLET_CONSTRAINTS.DEFAULT_CURRENCY,
      uppercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Wallet', walletSchema);