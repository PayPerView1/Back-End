const express = require('express');
const { protect } = require('../../middlewares/authMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const { requireBrandRole, verifyCampaignOwnership, verifyDraftOwnership } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { paymentRiskBodySchema, languageDetectionBodySchema, translationBodySchema } = require('../../validators/ai/aiIntelligence.validator');
const controller = require('../../controllers/ai/intelligence.controller');

const router = express.Router();

router.post(
  '/campaigns/drafts/:draftId/ai-assistance',
  protect,
  requireBrandRole,
  verifyDraftOwnership,
  controller.analyzeDraft
);

router.get(
  '/campaigns/:campaignId/ai-insights',
  protect,
  requireBrandRole,
  verifyCampaignOwnership,
  controller.analyzeCampaign
);

router.post(
  ['/wallet/intelligence', '/ai/wallet/intelligence'],
  protect,
  requireBrandRole,
  validate({ body: paymentRiskBodySchema }),
  controller.analyzeWallet
);

router.post('/language/detect', protect, validate({ body: languageDetectionBodySchema }), controller.detectLanguage);
router.post('/language/translate', protect, validate({ body: translationBodySchema }), controller.translateText);

module.exports = router;
