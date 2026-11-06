// src/validators/material/material.validator.js
// مخططات Joi لمسارات التنزيل. تُستعمل مع middlewares/validate.middleware:
//   validate({ params: downloadLinkParamsSchema })
const Joi = require('joi');

const objectId = (label) =>
  Joi.string()
    .hex()
    .length(24)
    .messages({
      'string.base': `${label} is invalid`,
      'string.empty': `${label} is required`,
      'string.hex': `${label} is invalid`,
      'string.length': `${label} is invalid`,
      'any.required': `${label} is required`,
    });

// POST /applications/:id/materials/:materialId/download-link
const downloadLinkParamsSchema = Joi.object({
  id: objectId('Application id').required(),
  materialId: objectId('Material id').required(),
});

// POST /applications/:id/materials/download-all
const downloadAllParamsSchema = Joi.object({
  id: objectId('Application id').required(),
});
const redeemParamsSchema = Joi.object({ token: Joi.string().trim().max(1000).required() });

const downloadIdParamsSchema = Joi.object({ logId: objectId('Download id').required() });

const reportDownloadBodySchema = Joi.object({
  status: Joi.string().valid('COMPLETED', 'FAILED').required(),
  reason: Joi.string().trim().max(200).allow('').when('status', { is: 'COMPLETED', then: Joi.forbidden() }),
});

const campaignDownloadsParamsSchema = Joi.object({ campaignId: objectId('Campaign id').required() });

const campaignDownloadsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  perPage: Joi.number().integer().min(1).max(50),
});

module.exports = {
  downloadLinkParamsSchema, downloadAllParamsSchema,
  redeemParamsSchema, downloadIdParamsSchema, reportDownloadBodySchema,
  campaignDownloadsParamsSchema, campaignDownloadsQuerySchema,
};