const mongoose = require('mongoose');

const campaignBudgetSnapshotSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  day: { type: Date, required: true },
  dailySpend: { type: Number, min: 0, required: true },
  remainingBudget: { type: Number, min: 0, required: true },
  dailyBudgetLimit: { type: Number, min: 0, default: null },
  totalBudget: { type: Number, min: 0, required: true },
  category: { type: String, default: null },
  contentType: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

campaignBudgetSnapshotSchema.index({ campaignId: 1, day: 1 }, { unique: true });
module.exports = mongoose.model('CampaignBudgetSnapshot', campaignBudgetSnapshotSchema);
