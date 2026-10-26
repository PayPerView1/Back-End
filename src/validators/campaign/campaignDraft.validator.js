// src/validators/campaign/campaignDraft.validator.js
const { body, validationResult } = require('express-validator');
const { CONTENT_TYPE } = require('../../constants/campaign.constants');
const {
  getMissingCampaignFields,
  MIXED_SUB_CATEGORIES,
} = require('./campaignCreation.validator');
const { normalizeCountryList } = require('../../utils/countries.utils');
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
   .custom((value, { req }) => {
     const { valid, invalid } = normalizeCountryList(value);
     if (invalid.length > 0) {
       throw new Error(`Invalid country codes (use ISO alpha-3, e.g. SAU): ${invalid.join(', ')}`);
     }
     req.body.targetCountries = valid; // أحرف كبيرة، بدون تكرار
     return true;
   }),

  // هون بس checkbox عام بسيط (halalDeclared: Boolean) — مش الـ 6 تفاصيل الدقيقة
  // (هاي التفاصيل الكاملة بتنبعت لاحقًا وقت submit نفسه، مش أثناء التسويد العادي)
  body('halalDeclared')
    .optional()
    .isBoolean()
    .withMessage('halalDeclared must be true or false'),
    // Sprint 4: إضافة maxApplicants و requirements للمسودة
    body('startDate').optional({ nullable: true })
    .isISO8601().withMessage('Start date must be a valid date').toDate(),

  body('endDate').optional({ nullable: true })
    .isISO8601().withMessage('End date must be a valid date').toDate()
    .custom((value, { req }) => {
      if (value && req.body.startDate && new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  body('maxApplicants').optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Max applicants must be a positive integer').toInt(),

  body('requirements.minFollowers').optional({ nullable: true })
    .isInt({ min: 0 }).withMessage('Min followers must be 0 or more').toInt(),

  body('requirements.minRating').optional({ nullable: true })
    .isFloat({ min: 0, max: 5 }).withMessage('Min rating must be between 0 and 5').toFloat(),

  // ============================================
  // [Sprint 5] قواعد التحقق من متطلبات التقديم للمسودة
  // ============================================
  body('submissionRequirements').optional(),

  body('submissionRequirements.platforms')
    .optional()
    .isArray()
    .withMessage('Platforms must be an array'),

  body('submissionRequirements.requiredHashtags')
    .optional()
    .isArray()
    .withMessage('Required hashtags must be an array'),

  body('submissionRequirements.requiredKeywords')
    .optional()
    .isArray()
    .withMessage('Required keywords must be an array'),

  body('submissionRequirements.requiredMentions')
    .optional()
    .isArray()
    .withMessage('Required mentions must be an array'),

  body('submissionRequirements.aspectRatio')
    .optional()
    .isIn(['9:16', '1:1', '16:9', '4:5'])
    .withMessage('Aspect ratio must be one of: 9:16, 1:1, 16:9, 4:5'),

  body('submissionRequirements.minDurationSec')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Min duration must be a positive integer')
    .toInt(),

  body('submissionRequirements.maxDurationSec')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Max duration must be a positive integer')
    .toInt()
    .custom((value, { req }) => {
      const min = req.body.submissionRequirements?.minDurationSec;
      if (value && min && parseInt(value) < parseInt(min)) {
        throw new Error('Max duration must be greater than or equal to min duration');
      }
      return true;
    }),

  body('submissionRequirements.shariaNote').optional().trim().isString(),
  body('submissionRequirements.offerCondition').optional().trim().isString(),
  body('submissionRequirements.clipIdea').optional().trim().isString(),

  body('maxSubmissionsPerCreator')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Max submissions per creator must be a positive integer')
    .toInt(),
];

// ============================================
// 3.2.3 — فحص اكتمال المسودة وقت POST /drafts/:draftId/submit
// ============================================
/**
 * ⚠️ هاي مش middleware بشكل express-validator عادي — هي middleware بسيط بيفحص
 * req.draft (يلي جاي أصلاً من verifyDraftOwnership) ويتأكد كل الحقول المطلوبة
 * موجودة وصحيحة (بنفس معايير إنشاء حملة كاملة)، وبيرجع قائمة بالحقول الناقصة تحديدًا.
 *
 * ⚠️ ملاحظة مهمة: المسودة (CampaignDraft) ما فيها إلا halalDeclared (boolean بسيط)،
 * مش الـ 6 تفاصيل الدقيقة. لهيك، تفاصيل إعلان الحلال الكاملة لازم تنبعت بجسم
 * طلب الـ submit نفسه (req.body.halalDeclaration)، ومنجمعها هون مع بيانات المسودة
 * قبل ما نفحص الاكتمال. النتيجة المدموجة منحطها بـ req.finalCampaignData عشان
 * الكونترولر/السيرفس يستخدمها مباشرة لإنشاء الحملة الفعلية بدون ما يعيد التجميع.
 */
const validateDraftSubmission = (req, res, next) => {
  const draft = req.draft;

  if (!draft) {
    return res.status(500).json({ /* ... */ });
  }

  // ⬇️ إضافة: تحويل halalDeclaration إذا كانت String
  let halalDeclaration = req.body.halalDeclaration;
  if (typeof halalDeclaration === 'string') {
    try {
      halalDeclaration = JSON.parse(halalDeclaration);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid JSON format for halalDeclaration' });
    }
  }

  const mergedData = {
    ...draft.toObject(),
    halalDeclaration,
  };

  const missingFields = getMissingCampaignFields(mergedData);

  if (missingFields.length > 0) {
    return res.status(400).json({ /* ... */ });
  }

  // ⬇️ إضافة: تمرير بيانات الغلاف والـ materials بشكل صريح
  req.finalCampaignData = {
    ...mergedData,
    coverImage: draft.coverImage,
    coverImagePublicId: draft.coverImagePublicId,
  };

  next();
};

module.exports = {
  draftCreationRules,
  draftUpdateRules,
  validate,
  validateDraftSubmission,
};