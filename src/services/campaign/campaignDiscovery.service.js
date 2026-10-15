// src/services/campaign/campaignDiscovery.service.js
// المالك: الشخص B — منطق الاكتشاف والتفاصيل والتوصيات.
// المرجع: API_CONTRACT_Sprint4.md §1, §2.1

const mongoose = require('mongoose');
const Campaign = require('../../models/campaign');
const User = require('../../models/user');
const Favorite = require('../../models/favorite');
const Application = require('../../models/application');
const { AppError } = require('../../utils/errors');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const {
  buildVisibleCampaignFilter,
  getAvailability,
  isPubliclyVisible,
} = require('../../utils/campaign/campaignVisibility.utils');
const { toPreviewMaterial } = require('../../utils/campaign/materialPreview.utils');
const { normalizeCountryList } = require('../../utils/countries.utils');
const { APPLICATION_STATUS, DISCOVER_SORT } = require('../../constants/discovery.constants');

// ============================================
// Helpers
// ============================================

/** يهرّب الأحرف الخاصة في regex */
const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** يبني شرط المحتوى (contentType أو subCategories) */
const buildContentTypeFilter = (contentType) => ({
  $or: [{ contentType }, { subCategories: contentType }],
});

// ============================================
// 1. Discover — GET /campaigns/discover
// ============================================
/**
 * @param {string} creatorId
 * @param {Object} filters — validated query من validator
 */
const getDiscoverCampaigns = async (creatorId, filters = {}) => {
  const { page, perPage, skip } = parsePagination(filters, {
    defaultPerPage: 20,
    maxPerPage: 50,
  });

  const {
    search,
    contentType,
    countries: countriesRaw,
    minCpm,
    maxCpm,
    sort = DISCOVER_SORT.NEWEST,
  } = filters;

  // 1. Base filter: الحملات الظاهرة
  const query = buildVisibleCampaignFilter();

  // 2. contentType (يطابق contentType أو subCategories)
  if (contentType) {
    Object.assign(query, buildContentTypeFilter(contentType));
  }

  // 3. countries — تُطبَّع من string إلى array alpha-3
  if (countriesRaw) {
    const raw = String(countriesRaw)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const { valid } = normalizeCountryList(raw);
    if (valid.length > 0) {
      query.targetCountries = { $in: valid };
    } else {
      // لا دول صالحة → نتيجة فاضية
      return {
        data: [],
        pagination: buildPageMeta(0, page, perPage),
      };
    }
  }

  // 4. CPM range
  if (minCpm != null || maxCpm != null) {
    query.cpm = {};
    if (minCpm != null) query.cpm.$gte = minCpm;
    if (maxCpm != null) query.cpm.$lte = maxCpm;
  }

  // 5. search — اسم الحملة أو اسم المعلن
  if (search && search.trim()) {
    const safe = escapeRegex(search.trim());
    const regex = new RegExp(safe, 'i');

    const brandIds = await User.find({
      role: 'BRAND',
      fullName: regex,
    })
      .select('_id')
      .lean();

    const searchOr = [{ name: regex }];
    if (brandIds.length > 0) {
      searchOr.push({ advertiserId: { $in: brandIds.map((b) => b._id) } });
    }

    query.$and = query.$and || [];
    query.$and.push({ $or: searchOr });
  }

  // 6. Sorting
  let sortObj = { createdAt: -1 };
  if (sort === DISCOVER_SORT.HIGHEST_CPM) sortObj = { cpm: -1, createdAt: -1 };
  else if (sort === DISCOVER_SORT.ENDING_SOON) sortObj = { endDate: 1, createdAt: -1 };
  // NEWEST و BEST_MATCH (مؤقتاً) → createdAt: -1

  // 7. Query — قائمة الحملات
  const [campaigns, total] = await Promise.all([
    Campaign.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(perPage)
      .populate('advertiserId', 'fullName profilePicture')
      .select('-materials -brief -aiReview -halalDeclaration -stats')
      .lean(),
    Campaign.countDocuments(query),
  ]);

  if (campaigns.length === 0) {
    return {
      data: [],
      pagination: buildPageMeta(0, page, perPage),
    };
  }

  // 8. إثراء: isFavorited + applicationStatus
  const campaignIds = campaigns.map((c) => c._id);
  const [favorites, applications] = await Promise.all([
    Favorite.find({ creatorId, campaignId: { $in: campaignIds } })
      .select('campaignId')
      .lean(),
    Application.find({ creatorId, campaignId: { $in: campaignIds } })
      .select('campaignId status')
      .lean(),
  ]);

  const favoritedSet = new Set(favorites.map((f) => f.campaignId.toString()));
  const appStatusMap = new Map();
  applications.forEach((a) => {
    const status =
      a.status === APPLICATION_STATUS.WITHDRAWN ? null : a.status;
    appStatusMap.set(a.campaignId.toString(), status);
  });

  // 9. بناء الاستجابة
  const data = campaigns.map((c) => {
    const availability = getAvailability(c);
    const unavailableReason =
      availability === 'UNAVAILABLE' && (c.remainingBudget || 0) <= 0
        ? 'BUDGET_EXHAUSTED'
        : null;

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
      subCategories: c.subCategories || [],
      cpm: c.cpm,
      remainingBudget: c.remainingBudget,
      targetCountries: c.targetCountries,
      isHalalVerified: true,
      availability,
      unavailableReason,
      endDate: c.endDate,
      isFavorited: favoritedSet.has(c._id.toString()),
      applicationStatus: appStatusMap.get(c._id.toString()) || null,
      createdAt: c.createdAt,
    };
  });

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 2. Suggestions — GET /campaigns/discover/suggestions
// ============================================
const getSuggestions = async (q) => {
  const safe = escapeRegex(q.trim());
  const regex = new RegExp(safe, 'i');

  const visibleFilter = buildVisibleCampaignFilter();

  const [campaigns, brands] = await Promise.all([
    Campaign.find({ ...visibleFilter, name: regex })
      .select('_id name')
      .limit(5)
      .lean(),
    User.find({ role: 'BRAND', fullName: regex })
      .select('_id fullName')
      .limit(5)
      .lean(),
  ]);

  const suggestions = [
    ...campaigns.map((c) => ({
      type: 'CAMPAIGN',
      id: c._id,
      label: c.name,
    })),
    ...brands.map((b) => ({
      type: 'BRAND',
      id: b._id,
      label: b.fullName,
    })),
  ];

  return suggestions.slice(0, 8);
};

// ============================================
// 3. Campaign Details — GET /campaigns/:campaignId/details
// ============================================
const getCampaignDetails = async (campaignId, creatorId) => {
  const campaign = await Campaign.findById(campaignId)
    .populate('advertiserId', 'fullName profilePicture')
    .lean();

  if (!campaign || !isPubliclyVisible(campaign)) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // application الخاص بالمبدع
  const application = await Application.findOne({
    campaignId: campaign._id,
    creatorId,
  })
    .select('_id status')
    .lean();

  const appStatus =
    application?.status === APPLICATION_STATUS.WITHDRAWN
      ? null
      : application?.status || null;

  // favoriteId
  const favorite = await Favorite.findOne({
    campaignId: campaign._id,
    creatorId,
  })
    .select('_id')
    .lean();

  // canApply + applyBlockedReason
  const availability = getAvailability(campaign);
  let canApply = true;
  let applyBlockedReason = null;

  if (!application || appStatus === null) {
    // لا يوجد تقديم → نفحص
    if (availability === 'UNAVAILABLE') {
      canApply = false;
      applyBlockedReason = 'CAMPAIGN_UNAVAILABLE';
    } else if (
      campaign.maxApplicants != null &&
      (campaign.applicantsCount || 0) >= campaign.maxApplicants
    ) {
      canApply = false;
      applyBlockedReason = 'APPLICANT_LIMIT_REACHED';
    }
    // requirements not enforced yet (Known Limitations)
  } else {
    // يوجد تقديم ساري
    canApply = false;
    applyBlockedReason = 'ALREADY_APPLIED';
  }

  const canDownloadMaterials = appStatus === APPLICATION_STATUS.ACCEPTED;

  // materials → previewUrl فقط
  const materials = (campaign.materials || []).map(toPreviewMaterial);

  return {
    id: campaign._id,
    name: campaign.name,
    brand: campaign.advertiserId
      ? {
          id: campaign.advertiserId._id,
          name: campaign.advertiserId.fullName,
          logo: campaign.advertiserId.profilePicture || null,
        }
      : null,
    contentType: campaign.contentType,
    subCategories: campaign.subCategories || [],
    cpm: campaign.cpm,
    remainingBudget: campaign.remainingBudget,
    targetCountries: campaign.targetCountries,
    isHalalVerified: true,
    availability,
    unavailableReason:
      availability === 'UNAVAILABLE' && (campaign.remainingBudget || 0) <= 0
        ? 'BUDGET_EXHAUSTED'
        : null,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    brief: campaign.brief,
    materials,
    canDownloadMaterials,
    maxApplicants: campaign.maxApplicants,
    applicantsCount: campaign.applicantsCount || 0,
    requirements: campaign.requirements || {
      minFollowers: null,
      minRating: null,
    },
    application: application
      ? { id: application._id, status: appStatus }
      : null,
    isFavorited: !!favorite,
    favoriteId: favorite?._id || null,
    canApply,
    applyBlockedReason,
  };
};

// ============================================
// 4. Recommendations — GET /campaigns/recommendations
// ============================================
/**
 * ⚠️ مؤقتاً يعمل كـ newest حتى إكمال B3 (matchScore).
 */
const getRecommendations = async (creatorId, limit = 10) => {
  // استثناء الحملات التي قدّم عليها المبدع
  const appliedCampaignIds = await Application.find({ creatorId })
    .select('campaignId')
    .lean();

  const excludedIds = appliedCampaignIds.map((a) => a.campaignId);

  const query = buildVisibleCampaignFilter();
  if (excludedIds.length > 0) {
    query._id = { $nin: excludedIds };
  }

  const campaigns = await Campaign.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('advertiserId', 'fullName profilePicture')
    .select('-materials -brief -aiReview -halalDeclaration -stats')
    .lean();

  if (campaigns.length === 0) {
    return { data: [], meta: { hasPreferences: false } };
  }

  const campaignIds = campaigns.map((c) => c._id);

  const favorites = await Favorite.find({
    creatorId,
    campaignId: { $in: campaignIds },
  })
    .select('campaignId')
    .lean();

  const favoritedSet = new Set(favorites.map((f) => f.campaignId.toString()));

  const data = campaigns.map((c) => {
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
      matchScore: 0,
      reasons: [],
    };
  });

  return {
    data,
    meta: { hasPreferences: false }, // مؤقتاً — يتغير في B3
  };
};

module.exports = {
  getDiscoverCampaigns,
  getSuggestions,
  getCampaignDetails,
  getRecommendations,
};