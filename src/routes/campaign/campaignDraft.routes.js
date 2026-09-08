// src/routes/campaign/campaignDraft.routes.js
const express = require('express');
const router = express.Router();

const {
  createDraft,
  getDraft,
  updateDraft,
  deleteDraft,
  autoSaveDraft,
  submitDraft,
} = require('../../controllers/campaign/campaignDraft.controller');

const { protect: authMiddleware } = require('../../middlewares/authMiddleware');
const {
  requireBrandRole,
  verifyDraftOwnership,
} = require('../../middlewares/campaign/campaignValidationMiddleware');

const {
  draftCreationRules,
  draftUpdateRules,
  validate,
  validateDraftSubmission,
} = require('../../validators/campaign/campaignDraft.validator');

// @route   POST /api/v1/campaigns/drafts
// @desc    إنشاء مسودة جديدة (اسم بس مطلوب)
router.post('/', authMiddleware, requireBrandRole, draftCreationRules, validate, createDraft);

// @route   GET /api/v1/campaigns/drafts/:draftId
// @desc    جلب مسودة بالتفصيل
router.get('/:draftId', authMiddleware, verifyDraftOwnership, getDraft);

// @route   PUT /api/v1/campaigns/drafts/:draftId
// @desc    تحديث مسودة (كل الحقول اختيارية)
router.put(
  '/:draftId',
  authMiddleware,
  verifyDraftOwnership,
  draftUpdateRules,
  validate,
  updateDraft
);

// @route   DELETE /api/v1/campaigns/drafts/:draftId
// @desc    حذف مسودة (+ ملفاتها المرفقة)
router.delete('/:draftId', authMiddleware, verifyDraftOwnership, deleteDraft);

// @route   PATCH /api/v1/campaigns/drafts/:draftId/auto-save
// @desc    حفظ تلقائي مع فحص تعارض النسخ
router.patch(
  '/:draftId/auto-save',
  authMiddleware,
  verifyDraftOwnership,
  draftUpdateRules,
  validate,
  autoSaveDraft
);

// @route   POST /api/v1/campaigns/drafts/:draftId/submit
// @desc    تسليم المسودة — تحويلها لحملة فعلية كاملة تحت المراجعة
router.post(
  '/:draftId/submit',
  authMiddleware,
  verifyDraftOwnership,
  validateDraftSubmission,
  submitDraft
);

module.exports = router;