// src/controllers/creator/favorite.controller.js
const favoriteService = require('../../services/creator/favorite.service');
const { sendError } = require('../../utils/errors');

const addFavorite = async (req, res) => {
  try {
    const { campaignId } = req.body;
    const creatorId = req.user._id;

    const result = await favoriteService.addFavorite(creatorId, campaignId);

    return res.status(result.alreadyExisted ? 200 : 201).json({
      success: true,
      data: {
        id: result.favoriteId,
        campaignId,
        createdAt: new Date().toISOString(),
        alreadyExisted: result.alreadyExisted,
      },
    });
  } catch (error) {
    return sendError(res, error, 'favorite.controller.addFavorite');
  }
};

const getFavorites = async (req, res) => {
  try {
    const creatorId = req.user._id;
    const filters = {
      sort: req.query.sort,
      availability: req.query.availability,
      contentType: req.query.contentType,
      page: req.query.page,
      perPage: req.query.perPage,
    };

    const result = await favoriteService.getFavorites(creatorId, filters);

    return res.status(200).json({
      success: true,
      data: result.favorites,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error, 'favorite.controller.getFavorites');
  }
};

const removeFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    const creatorId = req.user._id;

    await favoriteService.removeFavorite(id, creatorId);

    return res.status(200).json({
      success: true,
      data: { id, removed: true },
    });
  } catch (error) {
    return sendError(res, error, 'favorite.controller.removeFavorite');
  }
};

const bulkRemoveFavorites = async (req, res) => {
  try {
    const { ids } = req.body;
    const creatorId = req.user._id;

    const result = await favoriteService.bulkRemoveFavorites(ids, creatorId);

    return res.status(200).json({
      success: true,
      data: { deleted: result.deleted },
    });
  } catch (error) {
    return sendError(res, error, 'favorite.controller.bulkRemoveFavorites');
  }
};

module.exports = {
  addFavorite,
  getFavorites,
  removeFavorite,
  bulkRemoveFavorites,
};