// src/validators/campaign/campaignDiscovery.validator.js
// المالك: الشخص B — Joi schemas لكل endpoints الاكتشاف والتفاصيل.

const Joi = require('joi');
const { CONTENT_TYPE } = require('../../constants/campaign.constants');
const { DISCOVER_SORT } = require('../../constants/discovery.constants');

// ============================================
// GET /campaigns/discover
// ============================================
const discoverQuerySchema = Joi.object({
  search: Joi.string().trim().max(100).allow('', null),

  contentType: Joi.string()
    .valid(...Object.values(CONTENT_TYPE))
    .allow('', null),

  countries: Joi.string().trim().max(500).allow('', null),

  minCpm: Joi.number().min(0).allow(null),
  maxCpm: Joi.number().min(0).allow(null),

  sort: Joi.string()
    .valid(...Object.values(DISCOVER_SORT))
    .default(DISCOVER_SORT.NEWEST),

  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(50).default(20),
}).custom((value, helpers) => {
  if (
    value.minCpm != null &&
    value.maxCpm != null &&
    value.minCpm > value.maxCpm
  ) {
    return helpers.error('any.invalid', {
      message: 'minCpm cannot be greater than maxCpm',
    });
  }
  return value;
}, 'CPM range validation');

// ============================================
// GET /campaigns/discover/suggestions
// ============================================
const suggestionsQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Search query must be at least 2 characters',
    'string.max': 'Search query cannot exceed 50 characters',
    'any.required': 'Search query (q) is required',
  }),
});

// ============================================
// GET /campaigns/recommendations
// ============================================
const recommendationsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(10),
});

// ============================================
// GET /campaigns/:campaignId/details
// ============================================
const campaignIdParamSchema = Joi.object({
  campaignId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid campaign id format',
      'any.required': 'Campaign id is required',
    }),
});

module.exports = {
  discoverQuerySchema,
  suggestionsQuerySchema,
  recommendationsQuerySchema,
  campaignIdParamSchema,
};