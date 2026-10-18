// src/validators/application/application.validator.js
// المالك: الشخص B — Joi schemas لتقديمات المبدع.
// المرجع: API_CONTRACT_Sprint4.md §4.1-4.4

const Joi = require('joi');
const { APPLICATION_STATUS } = require('../../constants/discovery.constants');

// ============================================
// Params — :campaignId / :id (ObjectId)
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

const applicationIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid application id format',
      'any.required': 'Application id is required',
    }),
});

// ============================================
// POST /campaigns/:campaignId/apply
// ============================================
const applyBodySchema = Joi.object({
  message: Joi.string().trim().max(500).allow('', null).default('').messages({
    'string.max': 'Message cannot exceed 500 characters',
  }),
});

// ============================================
// GET /applications/my
// ============================================
const myApplicationsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(APPLICATION_STATUS))
    .allow('', null),
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(50).default(20),
});

module.exports = {
  campaignIdParamSchema,
  applicationIdParamSchema,
  applyBodySchema,
  myApplicationsQuerySchema,
};