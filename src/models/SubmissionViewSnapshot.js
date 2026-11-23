const mongoose = require('mongoose');
const { PLATFORM, POST_FETCH_STATUS } = require('../constants/submission.constants');

const countryViewSchema = new mongoose.Schema({
  countryCode: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
  views: { type: Number, required: true, min: 0 },
}, { _id: false });

const snapshotSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: Object.values(PLATFORM), required: true },
  sampleKey: { type: String, required: true },
  source: { type: String, required: true, enum: ['YOUTUBE_DATA_API', 'TIKTOK_OEMBED', 'INSTAGRAM_GRAPH_API'] },
  fetchStatus: { type: String, enum: Object.values(POST_FETCH_STATUS), required: true },
  views: { type: Number, default: null, min: 0 },
  likes: { type: Number, default: null, min: 0 },
  comments: { type: Number, default: null, min: 0 },
  shares: { type: Number, default: null, min: 0 },
  deltaViews: { type: Number, default: 0, min: 0 },
  eligibleViews: { type: Number, default: 0, min: 0 },
  countryViews: { type: [countryViewSchema], default: [] },
  // Per-sample high-water deltas avoid counting cumulative country totals repeatedly.
  countryDeltaViews: { type: [countryViewSchema], default: [] },
  flags: { type: [String], default: [] },
  reviewStatus: { type: String, enum: ['CLEAR', 'REVIEW_REQUIRED', 'CONFIRMED', 'DISMISSED'], default: 'CLEAR' },
  capturedAt: { type: Date, required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

snapshotSchema.index({ submissionId: 1, sampleKey: 1 }, { unique: true });
snapshotSchema.index({ submissionId: 1, capturedAt: -1 });
snapshotSchema.index({ campaignId: 1, capturedAt: -1 });
snapshotSchema.index({ creatorId: 1, capturedAt: -1 });
snapshotSchema.index({ reviewStatus: 1, capturedAt: 1 });

module.exports = mongoose.model('SubmissionViewSnapshot', snapshotSchema);
