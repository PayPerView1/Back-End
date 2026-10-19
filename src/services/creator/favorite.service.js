// src/services/creator/favorite.service.js
const Favorite = require('../../models/favorite');
const Campaign = require('../../models/campaign');
const { AppError } = require('../../utils/errors');
const { isPubliclyVisible, getAvailability } = require('../../utils/campaign/campaignVisibility.utils');

/**
 * Add a campaign to creator's favorites (idempotent)
 * @param {string} creatorId
 * @param {string} campaignId
 * @returns {Promise<{favoriteId: string, alreadyExisted: boolean}>}
 */
const addFavorite = async (creatorId, campaignId) => {
  // Verify campaign exists and is visible to creators
  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign || !isPubliclyVisible(campaign)) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  try {
    const favorite = await Favorite.create({
      creatorId,
      campaignId,
    });
    return { favoriteId: favorite._id, alreadyExisted: false };
  } catch (error) {
    if (error.code === 11000) {
      // Already exists - find and return existing
      const existing = await Favorite.findOne({ creatorId, campaignId }).lean();
      return { favoriteId: existing._id, alreadyExisted: true };
    }
    throw error;
  }
};

/**
 * Get creator's favorites with filtering and sorting
 * @param {string} creatorId
 * @param {Object} filters
 * @returns {Promise<{favorites: Array, pagination: Object}>}
 */
const getFavorites = async (creatorId, filters = {}) => {
  const {
    sort = 'newest',
    availability = 'ALL',
    contentType,
    page = 1,
    perPage = 20,
  } = filters;

  const filter = { creatorId };
  const skip = (page - 1) * perPage;

  // Build sort
  let sortOption = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'highestCpm') {
    sortOption = { 'campaignId.cpm': -1, createdAt: -1 };
  }

  // First get all favorites with populated campaign data
  let favoritesQuery = Favorite.find(filter)
    .populate({
      path: 'campaignId',
      select: 'name advertiserId contentType cpm remainingBudget targetCountries status isSuspended isArchived endDate pauseReason walletId',
      populate: {
        path: 'advertiserId',
        select: 'fullName profilePicture',
      },
    })
    .sort(sortOption)
    .skip(skip)
    .limit(perPage);

  const [favorites, total] = await Promise.all([
    favoritesQuery.lean(),
    Favorite.countDocuments(filter),
  ]);

  // Filter by availability and contentType
  const now = new Date();
  let filteredFavorites = favorites.filter(fav => {
    const campaign = fav.campaignId;
    if (!campaign) return false;

    // Filter by contentType
    if (contentType && campaign.contentType !== contentType) {
      return false;
    }

    // Filter by availability
    if (availability !== 'ALL') {
      const isAvailable = isPubliclyVisible(campaign, now);
      if (availability === 'AVAILABLE' && !isAvailable) return false;
      if (availability === 'UNAVAILABLE' && isAvailable) return false;
    }

    return true;
  });

  // Map to response format
  const result = filteredFavorites.map(fav => {
    const campaign = fav.campaignId;
    const availability = getAvailability(campaign, now);
    const isAvailable = availability === 'AVAILABLE';

    return {
      id: fav._id,
      createdAt: fav.createdAt,
      campaign: {
        id: campaign._id,
        name: campaign.name,
        brand: {
          id: campaign.advertiserId?._id,
          name: campaign.advertiserId?.fullName,
          logo: campaign.advertiserId?.profilePicture,
        },
        contentType: campaign.contentType,
        cpm: isAvailable ? campaign.cpm : null,
        remainingBudget: isAvailable ? campaign.remainingBudget : null,
        targetCountries: isAvailable ? campaign.targetCountries : null,
        availability,
        unavailableReason: isAvailable ? null : getUnavailableReason(campaign, now),
      },
    };
  });

  return {
    favorites: result,
    pagination: {
      page: parseInt(page),
      perPage: parseInt(perPage),
      total: filteredFavorites.length,
      totalPages: Math.ceil(filteredFavorites.length / perPage),
    },
  };
};

/**
 * Get unavailable reason for a campaign
 */
const getUnavailableReason = (campaign, now) => {
  if (!campaign.walletId) return 'NOT_AVAILABLE';
  if (campaign.isSuspended) return 'NOT_AVAILABLE';
  if (campaign.isArchived) return 'NOT_AVAILABLE';
  if (campaign.status === 'CANCELLED') return 'NOT_AVAILABLE';
  if (campaign.status === 'COMPLETED') return 'ENDED';
  if (campaign.status === 'EXPIRED') return 'ENDED';
  if (campaign.remainingBudget <= 0) return 'BUDGET_EXHAUSTED';
  return 'NOT_AVAILABLE';
};

/**
 * Remove a favorite
 * @param {string} favoriteId
 * @param {string} creatorId
 * @returns {Promise<{removed: boolean}>}
 */
const removeFavorite = async (favoriteId, creatorId) => {
  const favorite = await Favorite.findOneAndDelete({ _id: favoriteId, creatorId });
  if (!favorite) {
    throw new AppError('Favorite not found', 'NOT_FOUND');
  }
  return { removed: true };
};

/**
 * Bulk remove favorites
 * @param {Array<string>} ids
 * @param {string} creatorId
 * @returns {Promise<{deleted: number}>}
 */
const bulkRemoveFavorites = async (ids, creatorId) => {
  const result = await Favorite.deleteMany({
    _id: { $in: ids },
    creatorId,
  });
  return { deleted: result.deletedCount };
};

module.exports = {
  addFavorite,
  getFavorites,
  removeFavorite,
  bulkRemoveFavorites,
};