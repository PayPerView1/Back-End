// src/validators/campaign/campaignCreation.validator.js
const { body, validationResult } = require('express-validator');
const {
  CONTENT_TYPE,
  CAMPAIGN_CATEGORIES,
} = require('../../constants/campaign.constants');

// قائمة الـ sub-categories المسموحة تحديدًا لما contentType = MIXED
// (مأخوذة من CAMPAIGN_CATEGORIES نفسها، مش مكررة يدويًا، عشان تضل متزامنة معها دايمًا)
const MIXED_SUB_CATEGORIES = CAMPAIGN_CATEGORIES.find((c) => c.name === 'MIXED').subCategories;

// ============================================
// 3.1.2 — فحص إعلان الحلال (قابل لإعادة الاستخدام لحاله كمان)
// ============================================
/**
 * بتتحقق إنو إعلان الحلال موجود وكل الحقول الستة = true
 * @param {Object} halalDeclaration
 * @returns {{ valid: boolean, missingFields: string[] }}
 */
function validateHalalDeclaration(halalDeclaration) {
  const requiredFlags = [
    'noGambling',
    'noSexualContent',
    'noExplicitMusic',
    'noAlcohol',
    'noSuspiciousCurrencies',
    'noUnrealisticProfit',
  ];

  if (!halalDeclaration || typeof halalDeclaration !== 'object') {
    return { valid: false, missingFields: requiredFlags };
  }

  const missingFields = requiredFlags.filter((flag) => halalDeclaration[flag] !== true);

  return { valid: missingFields.length === 0, missingFields };
}

// ============================================
// دالة مشتركة: بتفحص "اكتمال" بيانات الحملة (مستخدمة هون + بـ campaignDraft.validator عند الـ submit)
// ============================================
/**
 * بترجع مصفوفة بأسماء الحقول الناقصة أو الغلط — مصفوفة فاضية = كل شي مكتمل وصحيح
 * @param {Object} data - بيانات الحملة (من req.body أو من مستند draft)
 * @returns {string[]} أسماء الحقول الناقصة
 */
function getMissingCampaignFields(data) {
  const missing = [];

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    missing.push('name');
  }

  if (!data.contentType || !Object.values(CONTENT_TYPE).includes(data.contentType)) {
    missing.push('contentType');
  }

  if (!data.category || !Object.values(CONTENT_TYPE).includes(data.category)) {
    missing.push('category');
  }

  if (data.contentType === CONTENT_TYPE.MIXED) {
    if (!Array.isArray(data.subCategories) || data.subCategories.length === 0) {
      missing.push('subCategories');
    }
  }

  if (typeof data.totalBudget !== 'number' || data.totalBudget <= 0) {
    missing.push('totalBudget');
  }

  if (typeof data.cpm !== 'number' || data.cpm <= 0) {
    missing.push('cpm');
  }

  if (!data.brief || !data.brief.mainIdea || !data.brief.mainIdea.trim()) {
    missing.push('brief.mainIdea');
  }

  if (!Array.isArray(data.targetCountries) || data.targetCountries.length === 0) {
    missing.push('targetCountries');
  }

  const halalCheck = validateHalalDeclaration(data.halalDeclaration);
  if (!halalCheck.valid) {
    missing.push('halalDeclaration');
  }

  return missing;
}

// ============================================
// 3.1.1 — قواعد فحص POST /api/v1/campaigns
// ============================================
const campaignCreationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ max: 255 })
    .withMessage('Campaign name cannot exceed 255 characters'),

  body('contentType')
    .notEmpty()
    .withMessage('Content type is required')
    .isIn(Object.values(CONTENT_TYPE))
    .withMessage(`Content type must be one of: ${Object.values(CONTENT_TYPE).join(', ')}`),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(Object.values(CONTENT_TYPE))
    .withMessage(`Category must be one of: ${Object.values(CONTENT_TYPE).join(', ')}`),

  // subCategories: مطلوبة بس لو contentType = MIXED
  body('subCategories')
    .custom((value, { req }) => {
      const isMixed = req.body.contentType === CONTENT_TYPE.MIXED;

      if (!isMixed) {
        return true; // مش MIXED، مش مطلوبة أصلاً
      }

      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('At least one sub-category is required when content type is MIXED');
      }

      const invalidValues = value.filter((v) => !MIXED_SUB_CATEGORIES.includes(v));
      if (invalidValues.length > 0) {
        throw new Error(`Invalid sub-categories: ${invalidValues.join(', ')}`);
      }

      return true;
    }),

  body('totalBudget')
    .notEmpty()
    .withMessage('Total budget is required')
    .isFloat({ gt: 0 })
    .withMessage('Total budget must be a positive number'),

  body('cpm')
    .notEmpty()
    .withMessage('CPM is required')
    .isFloat({ gt: 0 })
    .withMessage('CPM must be a positive number'),

  body('dailyBudgetLimit')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Daily budget limit must be a positive number if provided'),

  body('brief.mainIdea')
    .trim()
    .notEmpty()
    .withMessage('Brief main idea is required'),

  body('targetCountries')
    .isArray({ min: 1 })
    .withMessage('At least one target country is required')
    .custom((value) => {
      // كل عنصر لازم يكون كود دولة من 3 أحرف (ISO 3166-1 alpha-3)، مثل SAU, EGY, ARE
      const invalidCodes = value.filter((code) => !/^[A-Za-z]{3}$/.test(code));

      if (invalidCodes.length > 0) {
        throw new Error(`Invalid country codes (must be 3 letters): ${invalidCodes.join(', ')}`);
      }

      return true;
    }),

  body('halalDeclaration').custom((value) => {
    const { valid, missingFields } = validateHalalDeclaration(value);

    if (!valid) {
      throw new Error(`Halal declaration incomplete or not accepted: ${missingFields.join(', ')}`);
    }

    return true;
  }),
];

// middleware بيفحص نتيجة القواعد فوق ويرجع الأخطاء لو في
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
  campaignCreationRules,
  validate,
  validateHalalDeclaration,
  getMissingCampaignFields,
  MIXED_SUB_CATEGORIES,
};