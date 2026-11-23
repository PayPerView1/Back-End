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
const aiIntelligence = require('../ai/aiIntelligence.client');
const aiServiceConfig = require('../ai/aiServiceConfig');

const collectCollaborativeSignals = async (creatorId, appliedApps, candidateIds) => {
  const ownFavorites = await Favorite.find({ creatorId }).select('campaignId').lean();
  const interactedCampaignIds = [...new Set([
    ...appliedApps.map((item) => item.campaignId?.toString()).filter(Boolean),
    ...ownFavorites.map((item) => item.campaignId?.toString()).filter(Boolean),
  ])];
  if (!interactedCampaignIds.length || !candidateIds.length) return { signals: {}, peerCount: 0 };

  const peerFilters = { campaignId: { $in: interactedCampaignIds }, creatorId: { $ne: creatorId } };
  const [peerApplications, peerFavorites] = await Promise.all([
    Application.find({ ...peerFilters, status: { $in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.ACCEPTED] } })
      .select('creatorId').limit(5000).lean(),
    Favorite.find(peerFilters).select('creatorId').limit(5000).lean(),
  ]);
  const peerIds = [...new Set([...peerApplications, ...peerFavorites].map((item) => item.creatorId?.toString()).filter(Boolean))].slice(0, 500);
  if (!peerIds.length) return { signals: {}, peerCount: 0 };

  const candidateFilters = { creatorId: { $in: peerIds }, campaignId: { $in: candidateIds } };
  const [candidateApplications, candidateFavorites] = await Promise.all([
    Application.find({ ...candidateFilters, status: { $in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.ACCEPTED] } })
      .select('campaignId').limit(10000).lean(),
    Favorite.find(candidateFilters).select('campaignId').limit(10000).lean(),
  ]);
  const signals = {};
  [...candidateApplications, ...candidateFavorites].forEach((item) => {
    const id = item.campaignId?.toString();
    if (id) signals[id] = (signals[id] || 0) + 1;
  });
  return { signals, peerCount: peerIds.length };
};

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

  const candidateIds = candidates.map((campaign) => campaign._id);
  const collaborative = await collectCollaborativeSignals(creatorId, appliedApps, candidateIds);
  let semanticScores = {};
  const embeddingConfigured = aiServiceConfig.isConfigured();
  if (embeddingConfigured) {
    const profileTypes = [...new Set([...(preferences?.preferredContentTypes || []), ...previousContentTypes])];
    const profileTextAvailable = profileTypes.length > 0 || (preferences?.preferredCountries || []).length > 0;
    if (profileTextAvailable) {
      try {
        const ranking = await aiIntelligence.rankRecommendations({
          creatorProfile: {
            preferredContentTypes: profileTypes,
            preferredCountries: preferences?.preferredCountries || [],
          },
          campaigns: candidates.map((campaign) => ({
            id: campaign._id.toString(),
            content: [campaign.name, campaign.contentType, campaign.category, ...(campaign.subCategories || [])]
              .filter((part) => typeof part === 'string' && part.trim()).join(' ').slice(0, 8000),
            contentType: campaign.contentType,
            targetCountries: campaign.targetCountries || [],
          })),
          collaborativeSignals: collaborative.signals,
        });
        semanticScores = Object.fromEntries(ranking.data.map((item) => [item.campaignId, item.score]));
      } catch (error) {
        console.warn('[campaignRecommendation] AI embedding ranking unavailable; using database signals:', error.code || 'UNKNOWN');
      }
    }
  }

  // 5. Score from creator preferences, live peer interactions and optional fresh embeddings.
  const scored = candidates.map((c) => {
    const { score, reasons } = computeMatchScore(c, {
      preferences,
      previousContentTypes,
    });
    const peerSignalCount = collaborative.signals[c._id.toString()] || 0;
    if (peerSignalCount > 0) reasons.push({ code: 'SIMILAR_CREATORS_INTERACTED', value: peerSignalCount });
    const semanticScore = semanticScores[c._id.toString()] || 0;
    if (semanticScore >= 0.4) reasons.push({ code: 'CONTENT_SIMILARITY', value: semanticScore });
    const collaborativeScore = peerSignalCount && collaborative.peerCount
      ? Math.min(1, Math.log1p(peerSignalCount) / Math.log1p(collaborative.peerCount))
      : 0;
    return { campaign: c, score: score + collaborativeScore + (semanticScore * 2), reasons };
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
    .select('campaignId _id')
    .lean();

  const favoritedSet = new Set(favorites.map((f) => f.campaignId.toString()));
  const favoriteIdMap = new Map(favorites.map((f) => [f.campaignId.toString(), f._id]));
  // 9. بناء الاستجابة
  const data = top.map(({ campaign: c, score, reasons }) => {
    const availability = getAvailability(c);
    return {
      id: c._id,
      name: c.name,
      coverImage: c.coverImage || null,
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
      totalBudget: c.totalBudget,
      targetCountries: c.targetCountries,
      submissionRequirements: c.submissionRequirements || {},
      maxSubmissionsPerCreator: c.maxSubmissionsPerCreator || null,
      isHalalVerified: true,
      availability,
      isFavorited: favoritedSet.has(c._id.toString()),
      favoriteId: favoriteIdMap.get(c._id.toString()) || null,
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
