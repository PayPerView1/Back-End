// src/validators/submission/submission.validator.js
// المالك: المسار ب — Joi schemas لدورة التسليم.
// المرجع: API_CONTRACT_Sprint5.md §5.1-5.6

const Joi = require('joi');

const PLATFORM = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'];
const SUBMISSION_DISPLAY_STATUS = [
  'PROCESSING',
  'AI_REJECTED',
  'MANUAL_REVIEW',
  'AWAITING_ADVERTISER',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
];

// ============================================
// Params
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

const submissionIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid submission id format',
      'any.required': 'Submission id is required',
    }),
});

// ============================================
// POST /campaigns/:campaignId/submissions
// ============================================
const createSubmissionBodySchema = Joi.object({
  platform: Joi.string()
    .valid(...PLATFORM)
    .required()
    .messages({
      'any.only': 'Invalid platform',
      'any.required': 'Platform is required',
    }),
  url: Joi.string()
    .uri({ scheme: ['https'] })
    .max(500)
    .required()
    .messages({
      'string.uri': 'URL must be a valid HTTPS link',
      'string.max': 'URL cannot exceed 500 characters',
      'any.required': 'URL is required',
    }),
  hashtags: Joi.array()
    .items(Joi.string().trim().max(100))
    .max(30)
    .default([])
    .messages({
      'array.max': 'Cannot exceed 30 hashtags',
    }),
  keywords: Joi.array()
    .items(Joi.string().trim().max(100))
    .max(30)
    .default([])
    .messages({
      'array.max': 'Cannot exceed 30 keywords',
    }),
  notes: Joi.string().trim().max(500).allow('', null).default('').messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
  halalPledge: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the Halal pledge',
    'any.required': 'Halal pledge is required',
  }),
});

// ============================================
// GET /submissions/my
// ============================================
const mySubmissionsQuerySchema = Joi.object({
  displayStatus: Joi.string()
    .valid(...SUBMISSION_DISPLAY_STATUS)
    .allow('', null),
  campaignId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Invalid campaign id format',
    }),
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(50).default(20),
});

// ============================================
// PUT /submissions/:id/link
// ============================================
const updateLinkBodySchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['https'] })
    .max(500)
    .required()
    .messages({
      'string.uri': 'URL must be a valid HTTPS link',
      'string.max': 'URL cannot exceed 500 characters',
      'any.required': 'URL is required',
    }),
  reason: Joi.string().trim().max(300).allow('', null).default('').messages({
    'string.max': 'Reason cannot exceed 300 characters',
  }),
});

// ============================================
// POST /submissions/:id/resubmit
// ============================================
const resubmitBodySchema = Joi.object({
  platform: Joi.string()
    .valid(...PLATFORM)
    .allow('', null),
  url: Joi.string()
    .uri({ scheme: ['https'] })
    .max(500)
    .allow('', null)
    .messages({
      'string.uri': 'URL must be a valid HTTPS link',
      'string.max': 'URL cannot exceed 500 characters',
    }),
  hashtags: Joi.array().items(Joi.string().trim().max(100)).max(30).allow(null),
  keywords: Joi.array().items(Joi.string().trim().max(100)).max(30).allow(null),
  notes: Joi.string().trim().max(500).allow('', null),
});

module.exports = {
  PLATFORM,
  SUBMISSION_DISPLAY_STATUS,
  campaignIdParamSchema,
  submissionIdParamSchema,
  createSubmissionBodySchema,
  mySubmissionsQuerySchema,
  updateLinkBodySchema,
  resubmitBodySchema,
};