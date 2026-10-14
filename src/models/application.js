// src/models/application.js
const mongoose = require('mongoose');
const { APPLICATION_STATUS } = require('../constants/discovery.constants');

const applicationSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // رسالة تعريفية اختيارية من المبدع
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
      default: '',
    },

    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.PENDING,
    },

    // يُحدَّث عند إعادة التقديم بعد السحب (نفس المستند يُعاد استخدامه)
    appliedAt: { type: Date, default: Date.now },
    withdrawnAt: { type: Date, default: null },

    // قرار المعلن
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ----------------------
// Indexes
// ----------------------
// طلب واحد فقط لكل (حملة، مبدع) — يمنع التكرار حتى مع الطلبات المتزامنة
applicationSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });
// "My Applications" للمبدع
applicationSchema.index({ creatorId: 1, status: 1, appliedAt: -1 });
// قائمة المتقدمين للمعلن
applicationSchema.index({ campaignId: 1, status: 1, appliedAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);