// src/validators/campaign/campaignDraft.validator.js
const { body, validationResult } = require('express-validator');
const { CONTENT_TYPE } = require('../../constants/campaign.constants');
const {
  getMissingCampaignFields,
  MIXED_SUB_CATEGORIES,
} = require('./campaignCreation.validator');

// middleware مشترك بيفحص نتيجة أي قواعد express-validator (نفس فلسفة باقي المشروع)
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

// ============================================
// 3.2.1 — قواعد فحص POST /api/v1/campaigns/drafts
// ============================================
// المسودة وقت الإنشاء الأول محتاجة اسم بس، وباقي الحقول فيها تنضاف تدريجيًا بعدين
const draftCreationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Draft name is required')
    .isLength({ max: 255 })
    .withMessage('Draft name cannot exceed 255 characters'),
];

// ============================================
// 3.2.2 — قواعد فحص PUT /api/v1/campaigns/drafts/:draftId
// ============================================
// كل الحقول هون اختيارية (المسودة فيها تتحدث جزئيًا) — بس لو انبعت حقل، لازم يكون
// من النوع/الشكل الصحيح. ما فينا نفرض "اكتمال" هون، هاد بس شغل validateDraftSubmission
const draftUpdateRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Draft name cannot exceed 255 characters'),

  body('contentType')
    .optional()
    .isIn(Object.values(CONTENT_TYPE))
    .withMessage(`Content type must be one of: ${Object.values(CONTENT_TYPE).join(', ')}`),

  body('category')
    .optional()
    .isIn(Object.values(CONTENT_TYPE))
    .withMessage(`Category must be one of: ${Object.values(CONTENT_TYPE).join(', ')}`),

  body('subCategories')
    .optional()
    .isArray()
    .withMessage('Sub-categories must be an array')
    .custom((value) => {
      const invalidValues = value.filter((v) => !MIXED_SUB_CATEGORIES.includes(v));
      if (invalidValues.length > 0) {
        throw new Error(`Invalid sub-categories: ${invalidValues.join(', ')}`);
      }
      return true;
    }),

  body('totalBudget')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Total budget must be a positive number'),

  body('cpm')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('CPM must be a positive number'),

  body('dailyBudgetLimit')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Daily budget limit must be a positive number if provided'),

  body('brief.mainIdea')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Brief main idea cannot be empty if provided'),

  body('targetCountries')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Target countries must be a non-empty array if provided')
    .custom((value) => {
      const invalidCodes = value.filter((code) => !/^[A-Za-z]{3}$/.test(code));
      if (invalidCodes.length > 0) {
        throw new Error(`Invalid country codes (must be 3 letters): ${invalidCodes.join(', ')}`);
      }
      return true;
    }),

  // هون بالتحديث الجزئي، بس بنتحقق من نوع البيانات (كل حقل boolean لو موجود)
  // مش لازم تكون كلها true (هاد فحص "الاكتمال" بيصير وقت الـ submit بس)
  body('halalDeclaration')
    .optional()
    .isObject()
    .withMessage('Halal declaration must be an object')
    .custom((value) => {
      const flags = [
        'noGambling',
        'noSexualContent',
        'noExplicitMusic',
        'noAlcohol',
        'noSuspiciousCurrencies',
        'noUnrealisticProfit',
      ];

      const invalidFlags = flags.filter(
        (flag) => value[flag] !== undefined && typeof value[flag] !== 'boolean'
      );

      if (invalidFlags.length > 0) {
        throw new Error(`These halal declaration fields must be boolean: ${invalidFlags.join(', ')}`);
      }

      return true;
    }),
];

// ============================================
// 3.2.3 — فحص اكتمال المسودة وقت POST /drafts/:draftId/submit
// ============================================
/**
 * ⚠️ هاي مش middleware بشكل express-validator عادي — هي middleware بسيط بيفحص
 * req.draft (يلي جاي أصلاً من verifyDraftOwnership) ويتأكد كل الحقول المطلوبة
 * موجودة وصحيحة (بنفس معايير إنشاء حملة كاملة)، وبيرجع قائمة بالحقول الناقصة تحديدًا.
 */
const validateDraftSubmission = (req, res, next) => {
  const draft = req.draft;

  if (!draft) {
    // احتياط — هاد المفروض ما يصير أبدًا لو verifyDraftOwnership اشتغل قبله بالسلسلة
    return res.status(500).json({
      success: false,
      message: 'Draft not found on request. Make sure verifyDraftOwnership runs before this.',
    });
  }

  const missingFields = getMissingCampaignFields(draft);

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Draft is not complete enough to be submitted',
      missingFields,
    });
  }

  next();
};

module.exports = {
  draftCreationRules,
  draftUpdateRules,
  validate,
  validateDraftSubmission,
};