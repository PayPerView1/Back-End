const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const controller = require('../../controllers/wallet/creatorEarnings.controller');
const {
  paginationQuerySchema,
  paymentMethodIdParamsSchema,
  paymentMethodBodySchema,
  withdrawalBodySchema,
  withdrawalIntelligenceBodySchema,
} = require('../../validators/wallet/creatorEarnings.validator');

router.use('/creator', protect, requireClipperRole);
router.get('/creator/earnings', controller.getWallet);
router.get('/creator/earnings/prediction', controller.getEarningsPrediction);
router.get('/creator/earnings/transactions', validate({ query: paginationQuerySchema }), controller.listEarnings);
router.get('/creator/payment-methods', controller.listPaymentMethods);
router.post('/creator/payment-methods', validate({ body: paymentMethodBodySchema }), controller.addPaymentMethod);
router.delete('/creator/payment-methods/:id', validate({ params: paymentMethodIdParamsSchema }), controller.removePaymentMethod);
router.post('/creator/withdrawals', validate({ body: withdrawalBodySchema }), controller.requestWithdrawal);
router.post('/creator/withdrawals/intelligence', validate({ body: withdrawalIntelligenceBodySchema }), controller.analyzeWithdrawalIntelligence);
router.get('/creator/withdrawals', validate({ query: paginationQuerySchema }), controller.listWithdrawals);

module.exports = router;
