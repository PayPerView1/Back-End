// src/validators/wallet/walletFunding.validator.js

const Joi = require('joi');
const { PAYMENT_METHOD, WALLET_CONSTRAINTS } = require('../../constants/payment.constants');

const fundingSchema = Joi.object({
  amount: Joi.number()
    .required()
    .min(WALLET_CONSTRAINTS.MIN_DEPOSIT)
    .max(WALLET_CONSTRAINTS.MAX_DEPOSIT)
    .precision(2)
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
      'string.base': 'Payment method must be a string',
    }),
});

// body لـ POST /paypal/capture
const captureSchema = Joi.object({
  orderId: Joi.string().trim().max(64).required().messages({
    'any.required': 'orderId is required',
    'string.empty': 'orderId is required',
    'string.base': 'orderId must be a string',
  }),
});

// body لـ PUT /bank-transfer/:id
const reviewSchema = Joi.object({
  action: Joi.string().valid('APPROVE', 'REJECT').required().messages({
    'any.only': 'action must be APPROVE or REJECT',
    'any.required': 'action is required',
  }),
  note: Joi.when('action', {
    is: 'REJECT',
    then: Joi.string().trim().min(3).max(500).required().messages({
      'any.required': 'A rejection note is required',
      'string.empty': 'A rejection note is required',
      'string.min': 'Rejection note must be at least 3 characters',
      'string.max': 'Rejection note must be at most 500 characters',
    }),
    otherwise: Joi.string().allow('').max(500).optional(),
  }),
});

module.exports = { fundingSchema, captureSchema, reviewSchema };