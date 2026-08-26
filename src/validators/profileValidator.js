// src/validators/profileValidator.js
const { body, validationResult } = require('express-validator');
const { isValidPhoneNumber } = require('libphonenumber-js');
const countries = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');
const User = require('../models/user');

countries.registerLocale(enLocale);

// بتجيب object فيه كل أكواد الدول (ISO 3166-1 alpha-2) بشكل تلقائي
// مثال: { AF: 'Afghanistan', AL: 'Albania', ... }
// Object.keys بتاخد بس الأكواد (AF, AL, ...) وتجاهل الأسماء
const VALID_COUNTRIES = Object.keys(countries.getNames('en'));

// نفس القيم المسموحة الموجودة بموديل User - لازم تضل متطابقة معه دايمًا
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

  body('username')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain English letters, numbers, and underscore')
    .custom(async (value, { req }) => {
      // بندور إذا في مستخدم تاني (مش أنا نفسي) عنده نفس الـ username
      const existingUser = await User.findOne({ username: value.toLowerCase() });
 
      if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
        throw new Error('This username is already taken');
      }
 
      return true;
    }),

  // مقدمة الدولة (رمز الاتصال الدولي) - مثال: +970, +962, +1
  body('phoneCountryCode')
    .optional()
    .trim()
    .matches(/^\+[1-9]\d{0,3}$/)
    .withMessage('Country code must start with + followed by 1 to 4 digits (e.g. +970)'),

  // فحص رقم الهاتف مرتبط فعليًا بحقل phoneCountryCode (مش country المستخدمة لعنوان السكن)
  // بندمج المقدمة + الرقم مع بعض ونتحقق من الرقم الكامل الناتج
  body('phoneNumber')
    .optional()
    .trim()
    .custom((value, { req }) => {
      const countryCode = req.body.phoneCountryCode;

      // إذا المستخدم بعت رقم هاتف بدون ما يحدد المقدمة، ما فينا نتحقق منه صح
      if (!countryCode) {
        throw new Error('Phone country code (prefix) is required to validate phone number');
      }

      const fullNumber = `${countryCode}${value}`;

      // isValidPhoneNumber هون بتاخد الرقم كامل بصيغة E.164 (مقدمة + رقم مدمجين)
      // وبتتحقق من صحته بناءً على قواعد تلك المقدمة بالتحديد
      if (!isValidPhoneNumber(fullNumber)) {
        throw new Error(`Phone number is not valid for the given country code (${countryCode})`);
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

  // الاهتمامات - اختيارية بالكامل، المستخدم فيه يختار وحدة، أكتر من وحدة، كلهم، أو ولا وحدة
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

  // تاريخ الميلاد - لازم يكون تاريخ صحيح، مش بالمستقبل، وعمر لا يقل عن 13 سنة
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date (format: YYYY-MM-DD)')
    .toDate()
    .custom((value) => {
      const today = new Date();

      if (value > today) {
        throw new Error('Date of birth cannot be in the future');
      }

      // حساب العمر بالسنوات بدقة (مع مراعاة الشهر واليوم، مش بس الفرق بالسنة)
      let age = today.getFullYear() - value.getFullYear();
      const monthDiff = today.getMonth() - value.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < value.getDate())) {
        age--;
      }

      if (age < 13) {
        throw new Error('User must be at least 13 years old');
      }

      return true;
    }),

  // البايو - نص حر، حد أقصى 300 حرف
  body('bio')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage('Bio must not exceed 300 characters'),
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