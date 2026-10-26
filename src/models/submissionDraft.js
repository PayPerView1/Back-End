// src/models/submissionDraft.js
// مسودة تسليم ("حفظ لوقت لاحق"): مسودة واحدة لكل (مبدع، حملة)، تُحذف تلقائياً بعد 30 يوماً
const mongoose = require('mongoose');
const { PLATFORM, SUBMISSION_CONFIG } = require('../constants/submission.constants');

const submissionDraftSchema = new mongoose.Schema(
  {
    creatorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },

    // كل الحقول اختيارية: المبدع قد يحفظ نصف النموذج
    platform: { type: String, enum: [...Object.values(PLATFORM), null], default: null },
    postUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: SUBMISSION_CONFIG.URL_MAX_LENGTH,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: SUBMISSION_CONFIG.NOTES_MAX_LENGTH,
    },
    halalPledge: { type: Boolean, default: false },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + SUBMISSION_CONFIG.DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

// مسودة واحدة لكل مبدع في كل حملة (PUT = upsert)
submissionDraftSchema.index({ creatorId: 1, campaignId: 1 }, { unique: true });
// حذف تلقائي عند الوصول لـ expiresAt (TTL)
submissionDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SubmissionDraft', submissionDraftSchema);