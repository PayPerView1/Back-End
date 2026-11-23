const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['PAYPAL', 'BANK_TRANSFER', 'STC_PAY', 'MADA', 'OTHER'], required: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  details: {
    keyVersion: { type: String, required: true, select: false },
    iv: { type: String, required: true, select: false },
    tag: { type: String, required: true, select: false },
    ciphertext: { type: String, required: true, select: false },
  },
  fingerprint: { type: String, required: true, select: false },
  last4: { type: String, required: true, match: /^[A-Z0-9]{4}$/ },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  pendingWithdrawals: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

paymentMethodSchema.index({ creatorId: 1, isActive: 1, isDefault: -1 });
paymentMethodSchema.index({ creatorId: 1, fingerprint: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
paymentMethodSchema.index(
  { creatorId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isActive: true, isDefault: true } }
);

module.exports = mongoose.model('CreatorPaymentMethod', paymentMethodSchema);
