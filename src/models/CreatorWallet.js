const mongoose = require('mongoose');

const creatorWalletSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  currency: { type: String, default: 'USD', uppercase: true, trim: true },
  availableBalanceCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  pendingBalanceCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  reservedBalanceCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  totalEarningsCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  totalWithdrawnCents: { type: Number, default: 0, min: 0, validate: Number.isInteger },
}, { timestamps: true });

module.exports = mongoose.model('CreatorWallet', creatorWalletSchema);
