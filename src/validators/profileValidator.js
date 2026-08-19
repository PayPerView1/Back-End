// src/validators/profileValidator.js
const { body, validationResult } = require('express-validator');
const { isValidPhoneNumber } = require('libphonenumber-js');
const countries = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');

countries.registerLocale(enLocale);

// بتجيب object فيه كل أكواد الدول (ISO 3166-1 alpha-2) بشكل تلقائي
// مثال: { AF: 'Afghanistan', AL: 'Albania', ... }
// Object.keys بتاخد بس الأكواد (AF, AL, ...) وتجاهل الأسماء
const VALID_COUNTRIES = Object.keys(countries.getNames('en'));

const VALID_INTERESTS = [
  'LIFESTYLE',
  'TECHNOLOGY',
  'EDUCATION',
  'ENTERTAINMENT',
  'FINANCE',
  'HEALTH',
];

// قواعد التحقق لتحديث البروفايل
const updateProfileRules = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[a-zA-Zء-ي\s'.-]+$/)
    .withMessage('Full name must contain letters only')
    .custom((value) => {
      // منع اسم يبلش أو ينتهي أو فيه شرطة/فاصلة عليا/نقطة مكررة أو بشكل غلط
      // زي: "-Ahmad", "Ahmad-", "Ahmad--Ali", "O''Brien", "..Ahmad"
      if (/^[-'.]|[-'.]$/.test(value) || /[-'.]{2,}/.test(value)) {
        throw new Error('Full name format is invalid');
      }
      return true;
    }),

  body('country')
    .optional()
    .trim()
    .isIn(VALID_COUNTRIES)
    .withMessage('Please provide a valid country code'),

  // فحص رقم الهاتف مرتبط فعليًا بحقل country
  // لازم ياخد قيمة country من باقي الـ body عشان يتحقق صح
  body('phoneNumber')
    .optional()
    .trim()
    .custom((value, { req }) => {
      const country = req.body.country;

      // إذا المستخدم بعت رقم هاتف بدون ما يحدد الدولة، ما فينا نتحقق منه صح
      if (!country) {
        throw new Error('Country is required to validate phone number');
      }

      // isValidPhoneNumber بتاخد الرقم وكود الدولة (PS, JO...)
      // وبترجع true/false بناءً على قواعد تلك الدولة بالتحديد
      if (!isValidPhoneNumber(value, country)) {
        throw new Error(`Phone number is not valid for the selected country (${country})`);
      }

      return true;
    }),

  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters')
    .matches(/^[a-zA-Zء-ي\s'-]+$/)
    .withMessage('City must contain letters only'),

  body('profilePicture')
    .optional({ checkFalsy: true }) // لو الحقل جاي فاضي أو مش موجود (لأنو الصورة اترفعت كملف بدل رابط)، تجاهله
    .trim()
    .isURL()
    .withMessage('Profile picture must be a valid URL'),

  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array')
    .custom((value) => {
      // كل عنصر بالمصفوفة لازم يكون من القيم المسموحة
      const invalidValues = value.filter((v) => !VALID_INTERESTS.includes(v));
 
      if (invalidValues.length > 0) {
        throw new Error(`Invalid interests: ${invalidValues.join(', ')}`);
      }
 
      return true;
    }),
    
];

// Middleware بيفحص نتيجة التحقق ويرجع الأخطاء لو في
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
};

module.exports = {
  updateProfileRules,
  validate,
};