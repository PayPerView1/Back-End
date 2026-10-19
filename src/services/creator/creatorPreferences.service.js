// src/services/creator/creatorPreferences.service.js
// المالك: الشخص B — منطق تفضيلات المبدع.
// المرجع: API_CONTRACT_Sprint4.md §2.2-2.3

const CreatorPreferences = require('../../models/creatorPreferences');
const { normalizeCountryList } = require('../../utils/countries.utils');

// ============================================
// Defaults (تُرجع عندما لا يوجد مستند)
// ============================================
const DEFAULTS = {
  preferredContentTypes: [],
  preferredCountries: [],
  minCpm: 0,
};

// ============================================
// 1. Get Preferences
// ============================================
const getPreferences = async (creatorId) => {
  const prefs = await CreatorPreferences.findOne({ creatorId }).lean();

  if (!prefs) {
    return {
      preferredContentTypes: [...DEFAULTS.preferredContentTypes],
      preferredCountries: [...DEFAULTS.preferredCountries],
      minCpm: DEFAULTS.minCpm,
      updatedAt: null,
    };
  }

  return {
    preferredContentTypes: prefs.preferredContentTypes || [],
    preferredCountries: prefs.preferredCountries || [],
    minCpm: prefs.minCpm || 0,
    updatedAt: prefs.updatedAt,
  };
};

// ============================================
// 2. Upsert Preferences
// ============================================
/**
 * @param {string} creatorId
 * @param {{ preferredContentTypes?: string[], preferredCountries?: string[], minCpm?: number }} body
 */
const upsertPreferences = async (creatorId, body = {}) => {
  // تطبيع الدول إلى alpha-3
  let normalizedCountries = [];
  if (Array.isArray(body.preferredCountries)) {
    const { valid } = normalizeCountryList(body.preferredCountries);
    normalizedCountries = valid;
  }

  const update = {
    preferredContentTypes: body.preferredContentTypes || [],
    preferredCountries: normalizedCountries,
    minCpm: typeof body.minCpm === 'number' ? body.minCpm : 0,
  };

  const prefs = await CreatorPreferences.findOneAndUpdate(
    { creatorId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    preferredContentTypes: prefs.preferredContentTypes || [],
    preferredCountries: prefs.preferredCountries || [],
    minCpm: prefs.minCpm || 0,
    updatedAt: prefs.updatedAt,
  };
};

module.exports = {
  getPreferences,
  upsertPreferences,
};