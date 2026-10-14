// src/models/report.js
const mongoose = require('mongoose');
const {
  REPORT_REASON,
  REPORT_STATUS,
  REPORT_ACTION_TAKEN,
} = require('../constants/discovery.constants');

const reportSchema = new mongoose.Schema(
  {
    // المُبلِّغ: إما مستخدم مسجّل (reporterId) أو زائر (reporterEmail)
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reporterEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    // hash لعنوان الـ IP (لا نخزن الـ IP الخام) — لمكافحة الإساءة فقط
    reporterIpHash: {
      type: String,
      default: null,
      select: false,
    },

    // الهدف: حملة (الآن) أو clip (محجوز لسبرنت لاحق)
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },
    clipId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    reason: {
      type: String,
      enum: Object.values(REPORT_REASON),
      required: [true, 'Report reason is required'],
    },
    details: {
      type: String,
      trim: true,
      maxlength: [1000, 'Details cannot exceed 1000 characters'],
      default: '',
    },

    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.PENDING,
    },

    // المسجّل: true مباشرة. الزائر: false حتى يضغط رابط التأكيد المرسل لبريده.
    // البلاغ غير المؤكد لا يوقف الحملة ولا يظهر في قائمة المراجعة.
    isConfirmed: {
      type: Boolean,
      default: true,
    },
    confirmationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    confirmationExpiresAt: {
      type: Date,
      default: null,
    },

    // المراجعة (من فريق الإشراف)
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    actionTaken: {
      type: String,
      enum: [...Object.values(REPORT_ACTION_TAKEN), null],
      default: null,
    },
    reviewNote: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true, // createdAt و updatedAt
  }
);

// ----------------------
// Validation
// ----------------------
reportSchema.pre('validate', function () {
  if (!this.campaignId && !this.clipId) {
    this.invalidate('campaignId', 'A report must target a campaign or a clip');
  }

  if (!this.reporterId && !this.reporterEmail) {
    this.invalidate(
      'reporterEmail',
      'Reporter must be a logged-in user or provide an email'
    );
  }

  if (
    this.reason === REPORT_REASON.OTHER &&
    !(this.details && this.details.trim())
  ) {
    this.invalidate('details', 'Details are required when the reason is OTHER');
  }
});

// ----------------------
// Indexes
// ----------------------
// منع التكرار: نفس المستخدم المسجّل لا يبلّغ عن نفس الحملة مرتين
reportSchema.index(
  { campaignId: 1, reporterId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      campaignId: { $type: 'objectId' },
      reporterId: { $type: 'objectId' },
    },
  }
);

// منع التكرار: نفس الزائر (بالبريد) لا يبلّغ عن نفس الحملة مرتين
reportSchema.index(
  { campaignId: 1, reporterEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      campaignId: { $type: 'objectId' },
      reporterEmail: { $type: 'string' },
    },
  }
);

// قائمة المراجعة (الأدمن): حسب الحالة والأحدث
reportSchema.index({ status: 1, isConfirmed: 1, createdAt: -1 });
// بلاغات حملة معيّنة (لإغلاقها دفعة واحدة، ولمعرفة هل بقي بلاغ معلّق)
reportSchema.index({ campaignId: 1, status: 1 });

module.exports = mongoose.model('Report', reportSchema);