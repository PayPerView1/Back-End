// src/services/campaign/campaignRecommendation.service.js
// المالك: الشخص B — منطق التوصيات (Recommendations) للمبدع.
// المرجع: API_CONTRACT_Sprint4.md §2.1
//
// ⚠️ يعمل الآن بالكامل (بعد إضافة matchScore.utils.js).
//    لا يعتمد على B3 فقط — ياخذ التفضيلات + تاريخ التقديمات ويقيّم.

const Campaign = require('../../models/campaign');
const Application = require('../../models/application');
const Favorite = require('../../models/favorite');
const CreatorPreferences = require('../../models/creatorPreferences');
const { computeMatchScore } = require('../../utils/campaign/matchScore.utils');
const { buildVisibleCampaignFilter, getAvailability } = require('../../utils/campaign/campaignVisibility.utils');
const { APPLICATION_STATUS } = require('../../constants/discovery.constants');

// ============================================
// Helpers
// ============================================

/**
 * يجيب أنواع المحتوى من تقديمات المبدع السابقة (PENDING / ACCEPTED).
 * @param {string} creatorId
 * @returns {Promise<string[]>}
 */
const getPreviousContentTypes = async (creatorId) => {
  const apps = await Application.find({
    creatorId,
    status: { $in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.ACCEPTED] },
  })
    .populate('campaignId', 'contentType subCategories')
    .select('campaignId')
    .lean();

  const types = new Set();
  apps.forEach((a) => {
    const c = a.campaignId;
    if (!c) return;
    if (c.contentType) types.add(c.contentType);
    if (Array.isArray(c.subCategories)) {
      c.subCategories.forEach((sc) => types.add(sc));
    }
  });

  return Array.from(types);
};

// ============================================
// Recommendations
// ============================================
/**
 * @param {string} creatorId
 * @param {number} limit
 * @returns {Promise<{ data: Array, meta: { hasPreferences: boolean } }>}
 */
const getRecommendations = async (creatorId, limit = 10) => {
  // 1. جلب التفضيلات + التقديمات السابقة
  const [preferencesDoc, previousContentTypes, appliedApps] = await Promise.all([
    CreatorPreferences.findOne({ creatorId }).lean(),
    getPreviousContentTypes(creatorId),
    Application.find({ creatorId }).select('campaignId').lean(),
  ]);

  const hasPreferences = !!preferencesDoc;

  const preferences = preferencesDoc
    ? {
        preferredContentTypes: preferencesDoc.preferredContentTypes || [],
        preferredCountries: preferencesDoc.preferredCountries || [],
        minCpm: preferencesDoc.minCpm || 0,
      }
    : null;

  // 2. استثناء الحملات التي قدّم عليها المبدع
  const excludedIds = appliedApps.map((a) => a.campaignId);

  // 3. قاعدة الظهور
  const query = buildVisibleCampaignFilter();
  if (excludedIds.length > 0) {
    query._id = { $nin: excludedIds };
  }

  // 4. جلب مرشحين (أكبر من limit لأننا رح نرتّبهم بالـ matchScore)
  const candidates = await Campaign.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 5, 50))
    .populate('advertiserId', 'fullName profilePicture')
    .select('-materials -brief -aiReview -halalDeclaration -stats')
    .lean();

  if (candidates.length === 0) {
    return {
      data: [],
      meta: { hasPreferences },
    };
  }

  // 5. حساب matchScore لكل حملة
  const scored = candidates.map((c) => {
    const { score, reasons } = computeMatchScore(c, {
      preferences,
      previousContentTypes,
    });
    return { campaign: c, score, reasons };
  });

  // 6. ترتيب تنازلياً (score ثم createdAt)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.campaign.createdAt) - new Date(a.campaign.createdAt);
  });

  // 7. نأخذ limit
  const top = scored.slice(0, limit);

  // 8. جلب favorites لهذه الحملات
  const topIds = top.map((s) => s.campaign._id);
  const favorites = await Favorite.find({
    creatorId,
    campaignId: { $in: topIds },
  })
    .select('campaignId')
    .lean();

  const favoritedSet = new Set(favorites.map((f) => f.campaignId.toString()));

  // 9. بناء الاستجابة
  const data = top.map(({ campaign: c, score, reasons }) => {
    const availability = getAvailability(c);
    return {
      id: c._id,
      name: c.name,
      brand: c.advertiserId
        ? {
            id: c.advertiserId._id,
            name: c.advertiserId.fullName,
            logo: c.advertiserId.profilePicture || null,
          }
        : null,
      contentType: c.contentType,
      cpm: c.cpm,
      remainingBudget: c.remainingBudget,
      targetCountries: c.targetCountries,
      isHalalVerified: true,
      availability,
      isFavorited: favoritedSet.has(c._id.toString()),
      matchScore: score,
      reasons,
    };
  });

  return {
    data,
    meta: { hasPreferences },
  };
};

module.exports = {
  getRecommendations,
};