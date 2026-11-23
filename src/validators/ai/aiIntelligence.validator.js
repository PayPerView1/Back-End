const Joi = require('joi');
const { PAYMENT_METHOD, WALLET_CONSTRAINTS } = require('../../constants/payment.constants');

const paymentRiskBodySchema = Joi.object({
  amount: Joi.number().min(WALLET_CONSTRAINTS.MIN_DEPOSIT).max(WALLET_CONSTRAINTS.MAX_DEPOSIT).precision(2).optional(),
  paymentMethod: Joi.string().valid(...Object.values(PAYMENT_METHOD)).optional(),
  campaignId: Joi.string().hex().length(24).optional(),
  transactionId: Joi.string().hex().length(24).optional(),
}).unknown(false);

const languageDetectionBodySchema = Joi.object({ text: Joi.string().trim().min(1).max(5000).required() }).unknown(false);
const translationBodySchema = Joi.object({
  text: Joi.string().min(1).max(5000).required(),
  targetLanguage: Joi.string().valid('ar', 'en').required(),
  sourceLanguage: Joi.string().valid('ar', 'en').optional(),
}).unknown(false);

module.exports = { paymentRiskBodySchema, languageDetectionBodySchema, translationBodySchema };
