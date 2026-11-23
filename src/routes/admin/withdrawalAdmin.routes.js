const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware');
const adminOnly = require('../../middlewares/adminOnly');
const { validate } = require('../../middlewares/validate.middleware');
const controller = require('../../controllers/wallet/creatorEarnings.controller');
const {
  paymentMethodIdParamsSchema,
  adminWithdrawalQuerySchema,
  adminWithdrawalDecisionBodySchema,
} = require('../../validators/wallet/creatorEarnings.validator');

router.get(
  '/admin/withdrawals',
  protect,
  adminOnly,
  validate({ query: adminWithdrawalQuerySchema }),
  controller.listAdminWithdrawals
);
router.patch(
  '/admin/withdrawals/:id',
  protect,
  adminOnly,
  validate({ params: paymentMethodIdParamsSchema, body: adminWithdrawalDecisionBodySchema }),
  controller.processWithdrawal
);

module.exports = router;
