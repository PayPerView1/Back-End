const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(20),
});

const paymentMethodIdParamsSchema = Joi.object({ id: objectId.required() });

const paymentMethodBodySchema = Joi.object({
  type: Joi.string().valid('PAYPAL', 'BANK_TRANSFER', 'STC_PAY', 'MADA', 'OTHER').required(),
  label: Joi.string().trim().min(1).max(80).required(),
  details: Joi.object({
    accountName: Joi.string().trim().min(1).max(120).required(),
    accountIdentifier: Joi.string().trim().min(4).max(254).required(),
    bankName: Joi.string().trim().max(120).allow('').default(''),
  }).required().unknown(false),
  isDefault: Joi.boolean().default(false),
}).unknown(false);

const withdrawalBodySchema = Joi.object({
  amount: Joi.number().precision(2).positive().required(),
  paymentMethodId: objectId.required(),
});

const withdrawalIntelligenceBodySchema = Joi.object({
  amount: Joi.number().precision(2).positive(),
  paymentMethodId: objectId,
}).unknown(false);

const adminWithdrawalQuerySchema = paginationQuerySchema.append({
  status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
});

const adminWithdrawalDecisionBodySchema = Joi.object({
  decision: Joi.string().valid('PROCESS', 'COMPLETE', 'FAIL').required(),
  note: Joi.string().trim().max(1000).allow('').default(''),
  externalReference: Joi.string().trim().max(200)
    .when('decision', {
      is: 'COMPLETE',
      then: Joi.string().trim().min(1).max(200).required(),
      otherwise: Joi.string().trim().max(200).allow('').optional(),
    }),
}).unknown(false);

module.exports = {
  paginationQuerySchema,
  paymentMethodIdParamsSchema,
  paymentMethodBodySchema,
  withdrawalBodySchema,
  withdrawalIntelligenceBodySchema,
  adminWithdrawalQuerySchema,
  adminWithdrawalDecisionBodySchema,
};
