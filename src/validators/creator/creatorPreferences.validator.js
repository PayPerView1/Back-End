// src/validators/creator/creatorPreferences.validator.js
// المالك: الشخص B — Joi schema لتفضيلات المبدع.
// المرجع: API_CONTRACT_Sprint4.md §2.3

const Joi = require('joi');
const { CONTENT_TYPE } = require('../../constants/campaign.constants');

const updatePreferencesSchema = Joi.object({
  preferredContentTypes: Joi.array()
    .items(Joi.string().valid(...Object.values(CONTENT_TYPE)))
    .default([])
    .messages({
      'array.base': 'preferredContentTypes must be an array',
      'any.only': 'Invalid content type',
    }),

  preferredCountries: Joi.array()
    .items(Joi.string().trim().min(2).max(3))
    .max(30)
    .default([])
    .messages({
      'array.max': 'You can select up to 30 countries',
      'string.min': 'Invalid country code',
      'string.max': 'Invalid country code',
    }),

  minCpm: Joi.number().min(0).default(0).messages({
    'number.min': 'minCpm cannot be negative',
  }),
});

module.exports = {
  updatePreferencesSchema,
};