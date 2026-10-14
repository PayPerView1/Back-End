// src/middlewares/validate.middleware.js
// middleware عام للتحقق بـ Joi لـ endpoints سبرنت 4 (نفس مكتبة التحقق المستعملة في المحفظة).
//
// الاستخدام:
//   const { validate } = require('../../middlewares/validate.middleware');
//   router.get('/discover', protect, requireClipperRole,
//     validate({ query: discoverQuerySchema }), controller.discover);
//
// القيم بعد التحويل (مثلاً "50" → 50) تُقرأ من:
//   req.validated.query / req.validated.params / req.validated.body
// ونحدّث req.body أيضاً (مثل walletValidation.middleware) للتوافق.
// لا نعيد تعيين req.query لأنها للقراءة فقط في Express 5.

const JOI_OPTIONS = { abortEarly: false, stripUnknown: true, convert: true };

const PARTS = ['params', 'query', 'body'];

const validate = (schemas = {}) => (req, res, next) => {
  const validated = {};

  for (const part of PARTS) {
    const schema = schemas[part];
    if (!schema) continue;

    const { error, value } = schema.validate(req[part], JOI_OPTIONS);

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));

      return res.status(400).json({
        success: false,
        message: errors[0].message,
        code: 'VALIDATION_ERROR',
        errors,
      });
    }

    validated[part] = value;
  }

  req.validated = { ...(req.validated || {}), ...validated };
  if (validated.body) req.body = validated.body;

  next();
};

module.exports = { validate };