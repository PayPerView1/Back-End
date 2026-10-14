// src/models/creatorPreferences.js
const mongoose = require('mongoose');
const { CONTENT_TYPE } = require('../constants/campaign.constants');

const ALPHA3_REGEX = /^[A-Z]{3}$/;

const creatorPreferencesSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // مستند واحد لكل مبدع
    },

    // أنواع المحتوى التي يفضّل المبدع إنتاجها
    preferredContentTypes: {
      type: [String],
      enum: Object.values(CONTENT_TYPE),
      default: [],
    },

    // الدول التي يتواجد فيها جمهور المبدع (ISO 3166-1 alpha-3، مثل SAU)
    // بديل مؤقت لتوزيع الجمهور (R3.08) إلى أن يُبنى ربط الحسابات الاجتماعية
    preferredCountries: {
      type: [String],
      default: [],
      set: (arr) =>
        Array.isArray(arr)
          ? [...new Set(arr.map((c) => String(c).trim().toUpperCase()))]
          : arr,
      validate: {
        validator: (arr) => arr.every((c) => ALPHA3_REGEX.test(c)),
        message: 'Each country must be a valid ISO 3166-1 alpha-3 code (e.g. SAU)',
      },
    },

    // أدنى CPM يقبله المبدع (بالدولار)
    minCpm: {
      type: Number,
      min: [0, 'minCpm cannot be negative'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CreatorPreferences', creatorPreferencesSchema);