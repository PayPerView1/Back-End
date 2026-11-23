const Joi = require('joi');

const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(254)
  .required();

const loginBodySchema = Joi.object({
  email,
  password: Joi.string().min(1).required(),
});

const emailBodySchema = Joi.object({ email });

const changePasswordBodySchema = Joi.object({
  currentPassword: Joi.string().min(1).required(),
  newPassword: Joi.string().min(1).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
});

const resetPasswordBodySchema = Joi.object({
  password: Joi.string().min(1).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
});

const tokenParamsSchema = Joi.object({
  token: Joi.string().hex().length(64).required(),
});

module.exports = {
  loginBodySchema,
  emailBodySchema,
  changePasswordBodySchema,
  resetPasswordBodySchema,
  tokenParamsSchema,
};
