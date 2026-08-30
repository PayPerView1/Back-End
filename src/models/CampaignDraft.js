const mongoose = require('mongoose');
const {
  CONTENT_TYPE,
  MATERIAL_TYPE,
  DRAFT_EXPIRY_DAYS,
} = require('../constants/campaign.constants');

// ----------------------
// Sub-schema: مواد المسودة
// ----------------------
const draftMaterialSchema = new mongoose.Schema(
  {
    fileName:   { type: String, required: true },
    fileUrl:    { type: String, required: true },
    fileType:   { type: String, enum: Object.values(MATERIAL_TYPE), required: true },
    fileSizeKb: { type: Number, required: true },
    mimeType:   { type: String, required: true },
  },
  { _id: true, timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

// ----------------------
// Schema المسودة
// ----------------------
const campaignDraftSchema = new mongoose.Schema(
  {
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // الوحيد المطلوب للحفظ كمسودة
    name: {
      type: String,
      required: [true, 'Campaign name is required to save draft'],
      trim: true,
      maxlength: 255,
    },

    // كل ما يلي اختياري في المسودة
    contentType:    { type: String, enum: [...Object.values(CONTENT_TYPE), null], default: null },
    category:       { type: String, enum: [...Object.values(CONTENT_TYPE), null], default: null },
    subCategories:  { type: [String], default: [] },

    totalBudget:      { type: Number, default: null },
    cpm:              { type: Number, default: null },
    dailyBudgetLimit: { type: Number, default: null },

    brief: {
      mainIdea:         { type: String, default: '' },
      tone:             { type: String, default: '' },
      keyMessages:      { type: String, default: '' },
      keywords:         { type: [String], default: [] },
      visualReferences: { type: String, default: '' },
    },

    targetCountries: { type: [String], default: [] },

    halalDeclared: { type: Boolean, default: false },
    copyInfo: {
      isCopy: { 
        type: Boolean, 
        default: false 
      },
      copiedFromId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Campaign', 
        default: null 
      },
    },
    materials: {
      type: [draftMaterialSchema],
      default: [],
    },

    // إدارة المسودة
    status: {
      type: String,
      enum: ['DRAFT', 'EXPIRED'],
      default: 'DRAFT',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ----------------------
// Index مركب
// ----------------------
campaignDraftSchema.index({ advertiserId: 1, status: 1 });
campaignDraftSchema.index({ advertiserId: 1, lastSavedAt: -1 });

module.exports = mongoose.model('CampaignDraft', campaignDraftSchema);