const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const threadIdParamsSchema = Joi.object({
  threadId: objectId.required(),
});

const messageParamsSchema = Joi.object({
  threadId: objectId.required(),
  messageId: objectId.required(),
});

const createThreadBodySchema = Joi.object({
  title: Joi.string().trim().max(255).allow('').default(''),
}).unknown(false);

const sendMessageBodySchema = Joi.object({
  content: Joi.string().trim().min(1).max(4000).required(),
}).unknown(false);

const messageFeedbackBodySchema = Joi.object({
  rating: Joi.string().valid('HELPFUL', 'NOT_HELPFUL').required(),
  comment: Joi.string().trim().max(1000).allow('').default(''),
}).unknown(false);

module.exports = {
  threadIdParamsSchema,
  messageParamsSchema,
  createThreadBodySchema,
  sendMessageBodySchema,
  messageFeedbackBodySchema,
};
