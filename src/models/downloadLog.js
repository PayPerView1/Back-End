// src/models/downloadLog.js
// سجل تنزيل المواد المصدرية. كل سجل = رابط تنزيل واحد صادر لمبدع مقبول.
// الرابط يُستهلك مرة واحدة وينتهي بسرعة (consumedAt + linkExpiresAt)،
// والمعلن يرى من نزّل ماذا ومتى.
const mongoose = require('mongoose');
const {
  DOWNLOAD_TYPE,
  DOWNLOAD_STATUS,
} = require('../constants/submission.constants');

const downloadLogSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    campaignId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    creatorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // _id الملف داخل Campaign.materials (null عند تنزيل أرشيف كامل)
    materialId: { type: mongoose.Schema.Types.ObjectId, default: null },
    type: {
      type: String,
      enum: Object.values(DOWNLOAD_TYPE),
      default: DOWNLOAD_TYPE.FILE,
    },

    // لقطة وقت التنزيل (الملف قد يُحذف أو يُعاد تسميته لاحقاً)
    fileName:   { type: String, default: '' },
    fileSizeKb: { type: Number, default: null, min: 0 },

    status: {
      type: String,
      enum: Object.values(DOWNLOAD_STATUS),
      default: DOWNLOAD_STATUS.REQUESTED,
    },

    // الرابط الموقّع: صالح لمرة واحدة وحتى linkExpiresAt
    linkExpiresAt: { type: Date, required: true },
    consumedAt:    { type: Date, default: null },

    completedAt:   { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 200 },

    // لا نخزن IP خاماً (نفس أسلوب report.reporterIpHash)
    ipHash:    { type: String, default: null, select: false },
    userAgent: { type: String, default: '', maxlength: 200 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// سجل تنزيلات مبدع
downloadLogSchema.index({ creatorId: 1, createdAt: -1 });
// ما يراه المعلن عن حملته
downloadLogSchema.index({ campaignId: 1, createdAt: -1 });
downloadLogSchema.index({ campaignId: 1, creatorId: 1 });
downloadLogSchema.index({ materialId: 1 });

module.exports = mongoose.model('DownloadLog', downloadLogSchema);