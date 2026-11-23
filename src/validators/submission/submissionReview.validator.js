// src/validators/submission/submissionReview.validator.js
// المالك: المسار ب — Joi schemas للمراجعة (المعلن والأدمن).
// المرجع: API_CONTRACT_Sprint5.md §6

const Joi = require('joi');

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
// GET /campaigns/:campaignId/submissions — brand
// ============================================
const campaignSubmissionsQuerySchema = Joi.object({
  displayStatus: Joi.string()
    .valid(
      'ALL',
      'AWAITING_ADVERTISER',
      'APPROVED',
      'REJECTED',
      'CHANGES_REQUESTED',
      'AI_REJECTED',
      'WITHDRAWN'
    )
    .default('AWAITING_ADVERTISER'),
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(50).default(20),
});

// ============================================
// PUT /submissions/:id/review — brand
// ============================================
const reviewSubmissionBodySchema = Joi.object({
  decision: Joi.string()
    .valid('APPROVE', 'REJECT', 'REQUEST_EDITS')
    .required()
    .messages({
      'any.only': 'Decision must be APPROVE, REJECT, or REQUEST_EDITS',
      'any.required': 'Decision is required',
    }),
  note: Joi.string()
    .trim()
    .max(1000)
    .when('decision', {
      is: Joi.valid('REJECT', 'REQUEST_EDITS'),
      then: Joi.required().messages({
        'any.required': 'Review note is required',
        'string.empty': 'Review note cannot be empty',
      }),
      otherwise: Joi.optional().allow('', null),
    })
    .messages({
      'string.max': 'Note cannot exceed 1000 characters',
    }),
});

const bulkApproveBodySchema = Joi.object({
  submissionIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required())
    .min(1)
    .unique()
    .required(),
}).unknown(false);

const bulkReviewBodySchema = Joi.object({
  submissionIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required())
    .min(1)
    .unique()
    .required(),
  decision: Joi.string().valid('APPROVE', 'REJECT').required(),
  note: Joi.string().trim().max(1000).when('decision', {
    is: 'REJECT',
    then: Joi.string().trim().min(1).max(1000).required(),
    otherwise: Joi.string().trim().max(1000).allow('').optional(),
  }),
}).unknown(false);

// ============================================
// GET /admin/submissions/manual-review — admin
// ============================================
const manualReviewQueueQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(50).default(20),
});

// ============================================
// PUT /admin/submissions/:id/review — admin
// ============================================
const adminReviewBodySchema = Joi.object({
  decision: Joi.string()
    .valid('APPROVE', 'REJECT')
    .required()
    .messages({
      'any.only': 'Decision must be APPROVE or REJECT',
      'any.required': 'Decision is required',
    }),
  note: Joi.string()
    .trim()
    .max(1000)
    .when('decision', {
      is: 'REJECT',
      then: Joi.required().messages({
        'any.required': 'Rejection note is required',
      }),
      otherwise: Joi.optional().allow('', null),
    }),
});

module.exports = {
  campaignIdParamSchema,
  submissionIdParamSchema,
  campaignSubmissionsQuerySchema,
  reviewSubmissionBodySchema,
  bulkApproveBodySchema,
  bulkReviewBodySchema,
  manualReviewQueueQuerySchema,
  adminReviewBodySchema,
};
