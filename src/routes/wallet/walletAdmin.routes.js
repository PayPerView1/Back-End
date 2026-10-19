// src/routes/admin/walletAdmin.routes.js
//
// كل مسارات الأدمن الخاصة بالمحفظة في router واحد، يُركَّب في app.js مرة واحدة:
//   app.use('/api/v1/admin/wallet', walletAdminRoutes);
//
// المسارات الناتجة (تطابق API_CONTRACT_Sprint3):
//   PUT /api/v1/admin/wallet/bank-transfer/:id   ← مراجعة التحويل البنكي (APPROVE / REJECT)
//   PUT /api/v1/admin/wallet/refund/:id          ← مراجعة طلب الاسترداد  (APPROVE / REJECT)
//
// بما أن الـ router كله للأدمن ومركَّب على بادئة خاصة به، فيجوز وضع
// router.use(protect, adminOnly) هنا: لا يمرّ عليه أي طلب غير /admin/wallet/*.
const express = require('express');
const router = express.Router();

const { protect } = require('../../middlewares/authMiddleware');
const adminOnly = require('../../middlewares/adminOnly');

const { reviewBankTransfer } = require('../../controllers/wallet/walletFunding.controller');
const { reviewRefundRequest } = require('../../controllers/wallet/walletRefund.controller');

const { validateReview } = require('../../middlewares/wallet/walletValidation.middleware');
const { validateAdminRefundAction } = require('../../validators/wallet/walletRefund.validator');

router.use(protect, adminOnly);

// PUT /api/v1/admin/wallet/bank-transfer/:id
router.put('/bank-transfer/:id', validateReview, reviewBankTransfer);

// PUT /api/v1/admin/wallet/refund/:id
router.put('/refund/:id', validateAdminRefundAction, reviewRefundRequest);

module.exports = router;