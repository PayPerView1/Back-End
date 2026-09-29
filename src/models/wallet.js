// src/models/wallet.js
const mongoose = require('mongoose');
const { WALLET_CONSTRAINTS, PAYMENT_METHOD } = require('../constants/payment.constants');

const walletSchema = new mongoose.Schema(
  {
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    lastPaymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: null,
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