const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
  snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubmissionViewSnapshot', required: true, unique: true },
  views: { type: Number, required: true, min: 0 },
  grossAmountCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
  commissionCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
  netAmountCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
  currency: { type: String, default: 'USD', uppercase: true, trim: true },
  status: {
    type: String,
    enum: ['ON_HOLD', 'AVAILABLE', 'REVIEW_REQUIRED', 'PARTIALLY_RESERVED', 'RESERVED', 'PAID', 'REJECTED'],
    required: true,
  },
  unreservedAmountCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
  reservedAmountCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  paidAmountCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  availableAt: { type: Date, required: true },
  withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest', default: null },
}, { timestamps: true });

earningSchema.index({ creatorId: 1, createdAt: -1 });
earningSchema.index({ creatorId: 1, status: 1, availableAt: 1 });
earningSchema.index({ campaignId: 1, createdAt: -1 });

module.exports = mongoose.model('CreatorEarning', earningSchema);
