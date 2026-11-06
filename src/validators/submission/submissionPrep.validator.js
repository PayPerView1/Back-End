// src/validators/submission/submissionPrep.validator.js
// مخططات Joi لـ endpoints "تجهيز التسليم" (المسار أ). تُستعمل مع middlewares/validate.middleware:
//   router.post('/submissions/verify-link', ..., validate({ body: verifyLinkBodySchema }), controller)
//
// ⚠️ Express 5: req.body تكون undefined عند غياب جسم الطلب (وليست {})، لذلك المخطط
//    .required() كي لا يصل الـ controller بجسم غير موجود فيرمي خطأ 500.
const Joi = require('joi');
const { PLATFORM } = require('../../constants/submission.constants');

const PLATFORMS = Object.values(PLATFORM);

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

// POST /submissions/verify-link
const verifyLinkBodySchema = Joi.object({
  campaignId: objectId('Campaign id').required(),

  // نقبل tiktok و TikTok (نحوّلها إلى أحرف كبيرة)
  platform: Joi.string()
    .trim()
    .uppercase()
    .valid(...PLATFORMS)
    .required()
    .messages({
      'string.base': 'Platform is invalid',
      'string.empty': 'Platform is required',
      'any.only': `Platform must be one of: ${PLATFORMS.join(', ')}`,
      'any.required': 'Platform is required',
    }),

  // الصيغة تُفحص في linkParser (INVALID_LINK / UNSUPPORTED_PLATFORM) ليعرض الفرونت بانر "الرابط غير صالح".
  // هنا فقط: موجود، نص، وبحد أعلى كبير يحمي من الحمولات الضخمة (linkParser يرفض ما فوق 500 حرف).
  url: Joi.string()
    .trim()
    .max(2000)
    .required()
    .messages({
      'string.base': 'Link is invalid',
      'string.empty': 'Link is required',
      'string.max': 'Link is too long',
      'any.required': 'Link is required',
    }),
})
  .required()
  .messages({ 'any.required': 'Request body is required', 'object.base': 'Request body is invalid' });

const submissionDraftSchema = Joi.object({
  platform: Joi.string()
    .valid(...PLATFORMS)
    .allow(null)
    .messages({
      'string.base': 'Platform is invalid',
      'any.only': `Platform must be one of: ${PLATFORMS.join(', ')}`,
    }),

  url: Joi.string()
    .trim()
    .max(500)
    .allow('')
    .messages({
      'string.base': 'Link is invalid',
      'string.max': 'Link is too long',
    }),

  notes: Joi.string()
    .trim()
    .max(500)
    .allow('')
    .messages({
      'string.base': 'Notes are invalid',
      'string.max': 'Notes are too long',
    }),

  halalPledge: Joi.boolean()
    .messages({
      'boolean.base': 'Halal pledge must be a boolean',
    }),
});

module.exports = { verifyLinkBodySchema, submissionDraftSchema };