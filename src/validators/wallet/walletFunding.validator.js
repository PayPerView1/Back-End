// src/validators/wallet/walletFunding.validator.js

const Joi = require('joi');
const { PAYMENT_METHOD, WALLET_CONSTRAINTS } = require('../../constants/payment.constants');

const fundingSchema = Joi.object({
  amount: Joi.number()
    .required()
    .min(WALLET_CONSTRAINTS.MIN_DEPOSIT)
    .max(WALLET_CONSTRAINTS.MAX_DEPOSIT)
    .messages({
      'number.base': 'Please enter a valid numeric amount',
      'number.min': `Minimum top-up amount is $${WALLET_CONSTRAINTS.MIN_DEPOSIT}`,
      'number.max': `Maximum top-up amount is $${WALLET_CONSTRAINTS.MAX_DEPOSIT} per transaction`,
      'any.required': 'Amount is required',
    }),

  paymentMethod: Joi.string()
    .valid(...Object.values(PAYMENT_METHOD))
    .required()
    .messages({
      'any.only': `Payment method must be one of: ${Object.values(PAYMENT_METHOD).join(', ')}`,
      'any.required': 'Payment method is required',
    }),
});

module.exports = { fundingSchema };