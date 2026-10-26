// src/services/campaign/campaignDiscovery.service.js
// المالك: الشخص B — منطق الاكتشاف والتفاصيل.
// المرجع: API_CONTRACT_Sprint4.md §1
//
// التوصيات (recommendations) انتقلت إلى campaignRecommendation.service.js.

const Campaign = require('../../models/campaign');
const User = require('../../models/user');
const Favorite = require('../../models/favorite');
const Application = require('../../models/application');
const CreatorPreferences = require('../../models/creatorPreferences');
const { AppError } = require('../../utils/errors');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const {
  buildVisibleCampaignFilter,
  getAvailability,
  isPubliclyVisible,
} = require('../../utils/campaign/campaignVisibility.utils');
const { toPreviewMaterial } = require('../../utils/campaign/materialPreview.utils');
const { normalizeCountryList } = require('../../utils/countries.utils');
const { computeMatchScore } = require('../../utils/campaign/matchScore.utils');
const { APPLICATION_STATUS, DISCOVER_SORT } = require('../../constants/discovery.constants');

// ============================================
// Helpers
// ============================================

const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildContentTypeFilter = (contentType) => ({
  $or: [{ contentType }, { subCategories: contentType }],
});

// ============================================
// 1. Discover — GET /campaigns/discover
// ============================================
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

  const query = buildVisibleCampaignFilter();

  if (contentType) {
    Object.assign(query, buildContentTypeFilter(contentType));
  }

  if (countriesRaw) {
    const raw = String(countriesRaw)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const { valid } = normalizeCountryList(raw);
    if (valid.length > 0) {
      query.targetCountries = { $in: valid };
    } else {
      return {
        data: [],
        pagination: buildPageMeta(0, page, perPage),
      };
    }
  }

  if (minCpm != null || maxCpm != null) {
    query.cpm = {};
    if (minCpm != null) query.cpm.$gte = minCpm;
    if (maxCpm != null) query.cpm.$lte = maxCpm;
  }

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

  // Sorting — bestMatch يُعالج في الذاكرة بعد الاستعلام
  const isBestMatch = sort === DISCOVER_SORT.BEST_MATCH;
  let sortObj = { createdAt: -1 };
  if (sort === DISCOVER_SORT.HIGHEST_CPM) sortObj = { cpm: -1, createdAt: -1 };
  else if (sort === DISCOVER_SORT.ENDING_SOON) sortObj = { endDate: 1, createdAt: -1 };

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

  // Best Match — حساب score وترتيب في الذاكرة
  let orderedCampaigns = campaigns;
  let matchScores = null;

  if (isBestMatch) {
    const [preferencesDoc, previousApps] = await Promise.all([
      CreatorPreferences.findOne({ creatorId }).lean(),
      Application.find({
        creatorId,
        status: { $in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.ACCEPTED] },
      })
        .populate('campaignId', 'contentType subCategories')
        .select('campaignId')
        .lean(),
    ]);

    const preferences = preferencesDoc
      ? {
          preferredContentTypes: preferencesDoc.preferredContentTypes || [],
          preferredCountries: preferencesDoc.preferredCountries || [],
          minCpm: preferencesDoc.minCpm || 0,
        }
      : null;

    const previousContentTypes = new Set();
    previousApps.forEach((a) => {
      const c = a.campaignId;
      if (!c) return;
      if (c.contentType) previousContentTypes.add(c.contentType);
      if (Array.isArray(c.subCategories)) {
        c.subCategories.forEach((sc) => previousContentTypes.add(sc));
      }
    });

    const scoreMap = new Map();
    campaigns.forEach((c) => {
      const { score, reasons } = computeMatchScore(c, {
        preferences,
        previousContentTypes: Array.from(previousContentTypes),
      });
      scoreMap.set(c._id.toString(), { score, reasons });
    });

    orderedCampaigns = [...campaigns].sort((a, b) => {
      const sa = scoreMap.get(a._id.toString())?.score || 0;
      const sb = scoreMap.get(b._id.toString())?.score || 0;
      if (sb !== sa) return sb - sa;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    matchScores = scoreMap;
  }

  // إثراء: isFavorited + applicationStatus
  const campaignIds = campaigns.map((c) => c._id);
  const [favorites, applications] = await Promise.all([
    Favorite.find({ creatorId, campaignId: { $in: campaignIds } })
      .select('campaignId _id')
      .lean(),
    Application.find({ creatorId, campaignId: { $in: campaignIds } })
      .select('campaignId status')
      .lean(),
  ]);

  const favoritedSet = new Set(favorites.map((f) => f.campaignId.toString()));
  const favoriteIdMap = new Map(favorites.map((f) => [f.campaignId.toString(), f._id]));
  const appStatusMap = new Map();
  applications.forEach((a) => {
    const status =
      a.status === APPLICATION_STATUS.WITHDRAWN ? null : a.status;
    appStatusMap.set(a.campaignId.toString(), status);
  });

  const data = orderedCampaigns.map((c) => {
    const availability = getAvailability(c);
    const unavailableReason =
      availability === 'UNAVAILABLE' && (c.remainingBudget || 0) <= 0
        ? 'BUDGET_EXHAUSTED'
        : null;

    const matched = matchScores ? matchScores.get(c._id.toString()) : null;

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
      subCategories: c.subCategories || [],
      cpm: c.cpm,
      remainingBudget: c.remainingBudget,
      totalBudget: c.totalBudget,  
      targetCountries: c.targetCountries,
      isHalalVerified: true,
      availability,
      unavailableReason,
      endDate: c.endDate,
            // ⬇️ [Sprint 5]
      submissionRequirements: c.submissionRequirements || {},
      maxSubmissionsPerCreator: c.maxSubmissionsPerCreator || null,
      isFavorited: favoritedSet.has(c._id.toString()),
      // sprint 4
      favoriteId: favoriteIdMap.get(c._id.toString()) || null,
      applicationStatus: appStatusMap.get(c._id.toString()) || null,
      createdAt: c.createdAt,
      ...(matched && {
        matchScore: matched.score,
        reasons: matched.reasons,
      }),
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

  const favorite = await Favorite.findOne({
    campaignId: campaign._id,
    creatorId,
  })
    .select('_id')
    .lean();

  const availability = getAvailability(campaign);
  let canApply = true;
  let applyBlockedReason = null;

  if (!application || appStatus === null) {
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
  } else {
    canApply = false;
    applyBlockedReason = 'ALREADY_APPLIED';
  }

  const canDownloadMaterials = appStatus === APPLICATION_STATUS.ACCEPTED;
  const materials = (campaign.materials || []).map((m) => {
    const preview = toPreviewMaterial(m);
    if (canDownloadMaterials) {
      preview.downloadUrl = m.fileUrl; // إتاحة الرابط الأصلي للمقبولين فقط
    }
    return preview;
  });

  return {
    id: campaign._id,
    name: campaign.name,
    coverImage: campaign.coverImage || null,
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
    totalBudget: campaign.totalBudget,
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
        // ⬇️ [Sprint 5]
    submissionRequirements: campaign.submissionRequirements || {},
    maxSubmissionsPerCreator: campaign.maxSubmissionsPerCreator || null,
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

module.exports = {
  getDiscoverCampaigns,
  getSuggestions,
  getCampaignDetails,
};