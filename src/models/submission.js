// src/models/submission.js
// تسليم محتوى من مبدع لحملة (رابط منشور على تيك توك / إنستغرام / يوتيوب)
const mongoose = require('mongoose');
const { AI_REVIEW_RESULT } = require('../constants/campaign.constants');
const {
  PLATFORM,
  SUBMISSION_STATUS,
  LINK_HOLDING_STATUSES,
  ADVERTISER_STATUS,
  ADMIN_DECISION,
  REJECTED_BY,
  CHECK_STATUS,
  CHECK_SOURCE,
  POST_FETCH_STATUS,
  SUBMISSION_CONFIG,
  buildSubmissionCode,
} = require('../constants/submission.constants');

// ----------------------
// Sub-schemas
// ----------------------

// أرقام التفاعل (قد تكون null إذا لم تتح المنصة البيانات)
const statsSchema = new mongoose.Schema(
  {
    views:    { type: Number, default: null, min: 0 },
    likes:    { type: Number, default: null, min: 0 },
    comments: { type: Number, default: null, min: 0 },
    shares:   { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

// لقطة من بيانات المنشور وقت التسليم (من oEmbed / YouTube API)
const postMetaSchema = new mongoose.Schema(
  {
    fetchStatus: {
      type: String,
      enum: Object.values(POST_FETCH_STATUS),
      default: POST_FETCH_STATUS.UNAVAILABLE,
    },
    caption:      { type: String, default: '' }, // نص الوصف (منه نستخرج الهاشتاقات والمنشن)
    authorName:   { type: String, default: '' },
    authorHandle: { type: String, default: '' }, // @account
    authorUrl:    { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    durationSec:  { type: Number, default: null, min: 0 },
    publishedAt:  { type: Date, default: null },
    stats:        { type: statsSchema, default: null },
    fetchedAt:    { type: Date, default: null },
  },
  { _id: false }
);

// فحص جزئي (يظهر كبطاقة: مطابق / يحتاج تصحيح / فحص يدوي)
const checkSchema = new mongoose.Schema(
  {
    // نص حر عمداً (وليس enum) حتى لا يُرفض كود جديد من مهندس الـ AI
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_]{2,50}$/, 'Invalid check code'],
    },
    source:  { type: String, enum: Object.values(CHECK_SOURCE), required: true },
    status:  { type: String, enum: Object.values(CHECK_STATUS), required: true },
    message: { type: String, default: '', maxlength: 500 },  // تفصيل للعرض
    fixHint: { type: String, default: '', maxlength: 500 },  // كيف يصلحه المبدع
    score:   { type: Number, default: null, min: 0, max: 100 },
    // بيانات منظمة تترجمها الواجهة (مثلاً { found: [...], missing: [...] })
    meta:    { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const rejectionReasonSchema = new mongoose.Schema(
  {
    code:    { type: String, required: true },
    message: { type: String, default: '', maxlength: 500 },
  },
  { _id: false }
);

// نتيجة مراجعة الـ AI
const aiReviewSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(AI_REVIEW_RESULT),
      default: AI_REVIEW_RESULT.PENDING,
    },
    score:         { type: Number, default: null, min: 0, max: 100 },
    feedback:      { type: String, default: null },
    reviewedAt:    { type: Date, default: null },
    attempts:      { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date, default: null },
    lastError:     { type: String, default: null, maxlength: 300 },
  },
  { _id: false }
);

// قرار المعلن
const advertiserReviewSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(ADVERTISER_STATUS),
      default: ADVERTISER_STATUS.PENDING,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    note:       { type: String, default: '', maxlength: 1000 },
  },
  { _id: false }
);

// المراجعة اليدوية (أدمن) عند تحويل الـ AI
const adminReviewSchema = new mongoose.Schema(
  {
    reasonCode: { type: String, default: null }, // مثلاً AUDIO_UNCERTAIN / AI_UNAVAILABLE
    queuedAt:   { type: Date, default: null },
    decision:   { type: String, enum: [...Object.values(ADMIN_DECISION), null], default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    note:       { type: String, default: '', maxlength: 1000 },
  },
  { _id: false }
);

// سجل تغييرات الرابط (R2.12)
const linkHistorySchema = new mongoose.Schema(
  {
    postUrl:      { type: String, required: true },
    canonicalUrl: { type: String, default: '' },
    changedAt:    { type: Date, default: Date.now },
    reason:       { type: String, default: '', maxlength: 200 },
  },
  { _id: false }
);

// ----------------------
// الـ Schema الرئيسي
// ----------------------
const submissionSchema = new mongoose.Schema(
  {
    campaignId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    creatorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },

    // إعادة التسليم بعد رفض: تسليم جديد يشير للقديم (سجل تدقيق نظيف)
    resubmissionOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', default: null },
    attempt:        { type: Number, default: 1, min: 1 },

    // الرابط
    platform: { type: String, enum: Object.values(PLATFORM), required: true },
    postUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: SUBMISSION_CONFIG.URL_MAX_LENGTH,
    },
    canonicalUrl: { type: String, default: '' },  // الشكل الموحّد بعد التطبيع
    externalId:   { type: String, default: '' },  // معرّف الفيديو على المنصة
    // مفتاح منع التكرار: `${platform}:${externalId}`
    dedupKey:     { type: String, default: null },
    // true أثناء كون التسليم "يحجز" الرابط. يُضبط false عند الرفض/السحب
    linkLocked:   { type: Boolean, default: true },

    // ما يدخله المبدع (R2.11)
    keywords: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= SUBMISSION_CONFIG.MAX_HASHTAGS,
        message: `Cannot exceed ${SUBMISSION_CONFIG.MAX_HASHTAGS} keywords`,
      },
    },
    hashtags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= SUBMISSION_CONFIG.MAX_HASHTAGS,
        message: `Cannot exceed ${SUBMISSION_CONFIG.MAX_HASHTAGS} hashtags`,
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: SUBMISSION_CONFIG.NOTES_MAX_LENGTH,
    },
    // "تعهد شرعي" (خالٍ من المعازف ومطابق للضوابط)
    halalPledge: {
      accepted:   { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
    },

    // لقطة بيانات المنشور
    postMeta: { type: postMetaSchema, default: () => ({}) },

    // الفحوصات (RULES من الباك إند + AI من الخدمة)
    checks: { type: [checkSchema], default: [] },

    // المراجعات
    aiReview:         { type: aiReviewSchema, default: () => ({}) },
    advertiserReview: { type: advertiserReviewSchema, default: () => ({}) },
    adminReview:      { type: adminReviewSchema, default: () => ({}) },

    // الحالة
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.SUBMITTED,
    },
    rejectedBy:       { type: String, enum: [...Object.values(REJECTED_BY), null], default: null },
    rejectionReasons: { type: [rejectionReasonSchema], default: [] },

    // موعد الاعتماد التلقائي ("الحد الأقصى لاعتماد مكافأتك: خلال 23 ساعة")
    reviewDeadlineAt: { type: Date, default: null },

    // قفل المعالجة غير المتزامنة (يمنع معالجة نفس التسليم مرتين)
    processing: {
      lockedAt: { type: Date, default: null },
    },

    linkHistory: { type: [linkHistorySchema], default: [] },

    // الطوابع الزمنية
    submittedAt: { type: Date, default: Date.now },
    reviewedAt:  { type: Date, default: null },
    approvedAt:  { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// ----------------------
// Hooks
// ----------------------
// ⚠️ يعمل مع save()/create() فقط. أي تحديث عبر updateOne/findOneAndUpdate
// يجب أن يضبط linkLocked بنفسه (false عند REJECTED/WITHDRAWN).
submissionSchema.pre('validate', function () {
  if (this.platform && this.externalId) {
    this.dedupKey = `${this.platform}:${this.externalId}`;
  }
  this.linkLocked = LINK_HOLDING_STATUSES.includes(this.status);

  if (this.halalPledge && this.halalPledge.accepted && !this.halalPledge.acceptedAt) {
    this.halalPledge.acceptedAt = new Date();
  }
});

// ----------------------
// Virtual: رقم مرجعي للعرض (SUB-2026-A3F9C2)
// ----------------------
submissionSchema.virtual('code').get(function () {
  return buildSubmissionCode(this);
});

// ----------------------
// Indexes
// ----------------------
// منع تكرار الرابط عالمياً (منصة + معرّف الفيديو) طالما التسليم يحجزه
submissionSchema.index(
  { dedupKey: 1 },
  {
    unique: true,
    partialFilterExpression: { linkLocked: true, dedupKey: { $type: 'string' } },
  }
);
// "تسليماتي"
submissionSchema.index({ creatorId: 1, createdAt: -1 });
// عدّ التسليمات الفعّالة لمبدع في حملة
submissionSchema.index({ creatorId: 1, campaignId: 1, status: 1 });
// قائمة المعلن لحملته
submissionSchema.index({ campaignId: 1, status: 1, createdAt: -1 });
// job المعالجة العالقة (SUBMITTED + AI PENDING)
submissionSchema.index({ status: 1, 'aiReview.status': 1, 'processing.lockedAt': 1 });
// job الاعتماد التلقائي
submissionSchema.index({ status: 1, 'advertiserReview.status': 1, reviewDeadlineAt: 1 });
// طابور المراجعة اليدوية
submissionSchema.index({ status: 1, 'adminReview.queuedAt': 1 });

module.exports = mongoose.model('Submission', submissionSchema);
module.exports.buildSubmissionCode = buildSubmissionCode;