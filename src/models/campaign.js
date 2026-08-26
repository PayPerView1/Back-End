const mongoose = require('mongoose');
const {
  CAMPAIGN_STATUS,
  CONTENT_TYPE,
  MATERIAL_TYPE,
  AI_REVIEW_RESULT,
} = require('../constants/campaign.constants');

// ----------------------
// Sub-schema: المواد المرفقة
// ----------------------
const materialSchema = new mongoose.Schema(
  {
    fileName:   { type: String, required: true },
    fileUrl:    { type: String, required: true },
    fileType:   { type: String, enum: Object.values(MATERIAL_TYPE), required: true },
    fileSizeKb: { type: Number, required: true },
    mimeType:   { type: String, required: true },
    isPrimary:  { type: Boolean, default: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true, timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

// ----------------------
// Sub-schema: إعلان الحلال
// ----------------------
const halalDeclarationSchema = new mongoose.Schema(
  {
    noGambling:             { type: Boolean, required: true, default: false },
    noSexualContent:        { type: Boolean, required: true, default: false },
    noExplicitMusic:        { type: Boolean, required: true, default: false },
    noAlcohol:              { type: Boolean, required: true, default: false },
    noSuspiciousCurrencies: { type: Boolean, required: true, default: false },
    noUnrealisticProfit:    { type: Boolean, required: true, default: false },
    declaredBy:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    declaredAt:             { type: Date, default: Date.now },
    ipAddress:              { type: String, default: '' },
  },
  { _id: false }
  // _id: false لأنه sub-document مضمن وليس document مستقل
);

// ----------------------
// Sub-schema: نتيجة مراجعة الـ AI
// ----------------------
const aiReviewSchema = new mongoose.Schema(
  {
    result:      { type: String, enum: Object.values(AI_REVIEW_RESULT), default: AI_REVIEW_RESULT.PENDING },
    score:       { type: Number, min: 0, max: 100, default: null },
    feedback:    { type: String, default: null },
    reviewedAt:  { type: Date, default: null },
  },
  { _id: false }
);

// ----------------------
// Sub-schema: الموجه الإبداعي
// ----------------------
const creativeBreifSchema = new mongoose.Schema(
  {
    mainIdea:         { type: String, required: true },
    tone:             { type: String, default: '' },
    keyMessages:      { type: String, default: '' },
    keywords:         { type: [String], default: [] },
    visualReferences: { type: String, default: '' },
  },
  { _id: false }
);

// ----------------------
// Sub-schema: الإحصائيات (cached)
// ----------------------
const statsSchema = new mongoose.Schema(
  {
    totalViews:          { type: Number, default: 0 },
    totalApprovedVideos: { type: Number, default: 0 },
    totalCreators:       { type: Number, default: 0 },
    totalSpent:          { type: Number, default: 0 },
  },
  { _id: false }
);

// ----------------------
// Sub-schema: معلومات النسخ
// ----------------------
const copyInfoSchema = new mongoose.Schema(
  {
    isCopy:        { type: Boolean, default: false },
    copiedFromId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  },
  { _id: false }
);

// ----------------------
// الـ Schema الرئيسي
// ----------------------
const campaignSchema = new mongoose.Schema(
  {
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // معلومات الحملة الأساسية
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [255, 'Campaign name cannot exceed 255 characters'],
    },
    contentType: {
      type: String,
      enum: Object.values(CONTENT_TYPE),
      required: [true, 'Content type is required'],
    },
    category: {
      type: String,
      enum: Object.values(CONTENT_TYPE),
      required: [true, 'Category is required'],
    },
    subCategories: {
      type: [String],
      enum: Object.values(CONTENT_TYPE),
      default: [],
      // تُستخدم فقط إذا كان contentType = 'MIXED'
    },

    // الميزانية
    totalBudget: {
      type: Number,
      required: [true, 'Total budget is required'],
      min: [1, 'Budget must be greater than 0'],
    },
    remainingBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    cpm: {
      type: Number,
      required: [true, 'CPM is required'],
      min: [0.01, 'CPM must be greater than 0'],
    },
    dailyBudgetLimit: {
      type: Number,
      default: null,
      min: 0,
    },

    // الموجه الإبداعي
    brief: {
      type: creativeBreifSchema,
      required: true,
    },

    // الاستهداف الجغرافي
    // مصفوفة من رموز ISO 3166-1 alpha-3 مثل: ['SAU', 'EGY', 'ARE']
    targetCountries: {
      type: [String],
      required: [true, 'At least one target country is required'],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'At least one target country must be specified',
      },
    },

    // الحالة
    status: {
      type: String,
      enum: Object.values(CAMPAIGN_STATUS),
      default: CAMPAIGN_STATUS.DRAFT,
      index: true,
    },

    // مراجعة الـ AI
    aiReview: {
      type: aiReviewSchema,
      default: () => ({}),
    },

    // إعلان الحلال
    halalDeclaration: {
      type: halalDeclarationSchema,
      default: null,
    },

    // المواد المرفقة
    materials: {
      type: [materialSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Cannot upload more than 10 files per campaign',
      },
    },

    // الإحصائيات
    stats: {
      type: statsSchema,
      default: () => ({}),
    },

    // معلومات النسخ
    copyInfo: {
      type: copyInfoSchema,
      default: () => ({}),
    },
    copyCount: {
      type: Number,
      default: 0,
    },

    // الأرشفة
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },

    // طوابع الوقت الإضافية
    submittedAt:  { type: Date, default: null },
    activatedAt:  { type: Date, default: null },
    completedAt:  { type: Date, default: null },
  },
  {
    timestamps: true, // يضيف createdAt و updatedAt تلقائياً
  }
);

// ----------------------
// Indexes مركبة
// ----------------------
campaignSchema.index({ advertiserId: 1, status: 1 });
campaignSchema.index({ advertiserId: 1, createdAt: -1 });
campaignSchema.index({ advertiserId: 1, isArchived: 1 });
campaignSchema.index({ name: 'text' }); // للبحث النصي

// ----------------------
// Validation: subCategories مطلوبة إذا كان contentType = MIXED
// ----------------------
campaignSchema.pre('validate', function (next) {
  if (this.contentType === CONTENT_TYPE.MIXED && this.subCategories.length === 0) {
    this.invalidate(
      'subCategories',
      'At least one sub-category is required when content type is MIXED'
    );
  }
  next();
});

// ----------------------
// Validation: halalDeclaration يجب أن تكون جميع بنودها true عند الـ submit
// ----------------------
campaignSchema.methods.isHalalComplete = function () {
  const h = this.halalDeclaration;
  if (!h) return false;
  return (
    h.noGambling &&
    h.noSexualContent &&
    h.noExplicitMusic &&
    h.noAlcohol &&
    h.noSuspiciousCurrencies &&
    h.noUnrealisticProfit
  );
};

module.exports = mongoose.model('Campaign', campaignSchema);