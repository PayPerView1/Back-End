// src/validators/wallet/walletRefund.validator.js

const Joi = require('joi');
const { REFUND_STATUS, WALLET_CONSTRAINTS } = require('../../constants/payment.constants');

// ----------------------
// Schema: تقديم طلب استرداد
// ----------------------
const submitRefundSchema = Joi.object({
  amount: Joi.number()
    .required()
    .min(WALLET_CONSTRAINTS.MIN_REFUND)
    .messages({
      'number.base': 'Please enter a valid numeric amount',
      'number.min': `Minimum refund amount is $${WALLET_CONSTRAINTS.MIN_REFUND}`,
      'any.required': 'Amount is required',
    }),
});

// ----------------------
// Schema: موافقة/رفض الأدمن
// ----------------------
const adminRefundActionSchema = Joi.object({
  action: Joi.string()
    .valid('APPROVE', 'REJECT')
    .required()
    .messages({
      'any.only': 'Action must be either APPROVE or REJECT',
      'any.required': 'Action is required',
    }),
  note: Joi.when('action', {
    is: 'REJECT',
    then: Joi.string().required().messages({
      'any.required': 'Rejection note is required',
      'string.empty': 'Rejection note cannot be empty',
    }),
    otherwise: Joi.string().optional().allow('', null),
  }),
});

// ----------------------
// Middleware: التحقق من طلب الاسترداد
// ----------------------
const validateSubmitRefund = (req, res, next) => {
  const { error } = submitRefundSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const messages = error.details.map((d) => d.message);

    let code = 'VALIDATION_ERROR';
    if (messages.some((m) => m.includes('Minimum'))) code = 'AMOUNT_TOO_LOW';

    return res.status(400).json({
      success: false,
      message: messages[0],
      code,
    });
  }

  next();
};

// ----------------------
// Middleware: التحقق من قرار الأدمن
// ----------------------
const validateAdminRefundAction = (req, res, next) => {
  const { error } = adminRefundActionSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const messages = error.details.map((d) => d.message);

    return res.status(400).json({
      success: false,
      message: messages[0],
      code: 'VALIDATION_ERROR',
    });
  }

  next();
};

module.exports = {
  validateSubmitRefund,
  validateAdminRefundAction,
};