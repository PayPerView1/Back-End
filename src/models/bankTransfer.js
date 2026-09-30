const mongoose = require('mongoose');
const { BANK_TRANSFER_STATUS } = require('../constants/payment.constants');

const bankTransferSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true, // كل transaction له bank_transfer واحد فقط
      index: true,
    },
    receiptUrl: {
      type: String,
      required: [true, 'Receipt URL is required'],
    },
    status: {
      type: String,
      enum: Object.values(BANK_TRANSFER_STATUS),
      default: BANK_TRANSFER_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // الأدمن الذي راجع الطلب
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BankTransfer', bankTransferSchema);