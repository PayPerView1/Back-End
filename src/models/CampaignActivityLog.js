const mongoose = require('mongoose');
const { CAMPAIGN_ACTION } = require('../constants/campaign.constants');

const campaignActivityLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(CAMPAIGN_ACTION),
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // null = النظام (AI أو cron job)
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // بيانات مرنة: سبب الرفض، الميزانية المضافة، إلخ
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    // هذا الـ log للقراءة فقط، لا حاجة لـ updatedAt
  }
);

campaignActivityLogSchema.index({ campaignId: 1, createdAt: -1 });

module.exports = mongoose.model('CampaignActivityLog', campaignActivityLogSchema);