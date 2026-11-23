const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  earningId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorEarning', required: true },
  amountCents: { type: Number, required: true, min: 1, validate: Number.isInteger },
}, { _id: false });

const withdrawalRequestSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentMethodId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorPaymentMethod', required: true },
  amountCents: { type: Number, required: true, min: 1, validate: Number.isInteger },
  currency: { type: String, default: 'USD', uppercase: true, trim: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  note: { type: String, default: '', maxlength: 1000 },
  earningAllocations: { type: [allocationSchema], default: [] },
  externalReference: { type: String, default: '', maxlength: 200 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  processedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  failedAt: { type: Date, default: null },
}, { timestamps: true });

withdrawalRequestSchema.index({ creatorId: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
