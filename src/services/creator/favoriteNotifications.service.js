
// src/services/creator/favoriteNotifications.service.js
const Favorite = require('../../models/favorite');
const { createManyNotifications } = require('../notification/notification.service');
const { buildNotification } = require('../notification/notification.templates');
const { NOTIFICATION_TYPE } = require('../../constants/discovery.constants');

/**
 * Notify all creators who favorited a campaign that it's no longer available.
 * @param {string|ObjectId} campaignId
 * @param {string} campaignName
 * @param {string} reason - 'BUDGET_EXHAUSTED' | 'ENDED' | 'NOT_AVAILABLE'
 */
const notifyFavoritersCampaignUnavailable = async (campaignId, campaignName, reason) => {
  try {
    const favorites = await Favorite.find({ campaignId }).select('creatorId -_id');

    if (favorites.length === 0) return;

    const notifications = favorites.map(fav => ({
      userId: fav.creatorId,
      ...buildNotification(
        NOTIFICATION_TYPE.FAVORITE_CAMPAIGN_UNAVAILABLE,
        { campaignName },
        { campaignId, favoriteId: fav._id, reason }
      )
    }));

    await createManyNotifications(notifications);
  } catch (error) {
    console.error(`[favoriteNotifications] Failed to notify favoriters: ${error.message}`);
  }
};

module.exports = {
  notifyFavoritersCampaignUnavailable,
};