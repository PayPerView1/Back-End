// src/validators/creator/favorite.validator.js
const Joi = require('joi');
const { validate } = require('../../middlewares/validate.middleware');

const addFavoriteSchema = {
  body: Joi.object({
    campaignId: Joi.string().hex().length(24).required(),
  }),
};

const getFavoritesSchema = {
  query: Joi.object({
    sort: Joi.string().valid('newest', 'oldest', 'highestCpm').default('newest'),
    availability: Joi.string().valid('ALL', 'AVAILABLE', 'UNAVAILABLE').default('ALL'),
    contentType: Joi.string().valid('CLIPPING', 'UGC', 'SLIDESHOW', 'AUDIO', 'LOGO', 'MIXED'),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(50).default(20),
  }),
};

const removeFavoriteSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

const bulkRemoveFavoritesSchema = {
  body: Joi.object({
    ids: Joi.array().items(Joi.string().hex().length(24)).min(1).max(100).required(),
  }),
};

module.exports = {
  validateAddFavorite: validate(addFavoriteSchema),
  validateGetFavorites: validate(getFavoritesSchema),
  validateRemoveFavorite: validate(removeFavoriteSchema),
  validateBulkRemoveFavorites: validate(bulkRemoveFavoritesSchema),
};