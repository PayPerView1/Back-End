// src/models/favorite.js
const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ----------------------
// Indexes
// ----------------------
// حملة واحدة مرة واحدة في مفضلة المبدع
favoriteSchema.index({ creatorId: 1, campaignId: 1 }, { unique: true });
// قائمة المفضلة مرتبة بالأحدث
favoriteSchema.index({ creatorId: 1, createdAt: -1 });
// لإشعار كل من فضّل حملة عند توقفها (fan-out)
favoriteSchema.index({ campaignId: 1 });

module.exports = mongoose.model('Favorite', favoriteSchema);