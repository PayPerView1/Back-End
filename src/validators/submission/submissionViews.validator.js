const Joi = require('joi');
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const submissionIdParamsSchema = Joi.object({ id: objectId.required() });
const campaignIdParamsSchema = Joi.object({ campaignId: objectId.required() });
const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(20),
});
const reviewSnapshotBodySchema = Joi.object({
  decision: Joi.string().valid('CONFIRM', 'DISMISS').required(),
}).unknown(false);

module.exports = {
  submissionIdParamsSchema,
  campaignIdParamsSchema,
  paginationQuerySchema,
  reviewSnapshotBodySchema,
};
