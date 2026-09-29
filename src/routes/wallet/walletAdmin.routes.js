// src/routes/wallet/walletAdmin.routes.js
//
// ⚠️ ملف مخصص لتجميع كل endpoints الأدمن الخاصة بنظام المحفظة (wallet) بمكان واحد،
// لأنها بادئتها مختلفة (/api/admin/wallet) عن مسارات المعلن العادية (/api/wallet).
// حاليًا فيه مسار مراجعة التحويل البنكي، ولاحقًا رح ينضم إله مسار مراجعة الاسترداد
// (Task T-B-03: PUT /api/admin/wallet/refund/:id) بنفس الملف.

const express = require('express');
const router = express.Router();

const { reviewBankTransfer } = require('../../controllers/wallet/walletFunding.controller');
const { reviewRefund } = require('../../controllers/wallet/walletRefund.controller');
const { protect: authMiddleware } = require('../../middlewares/authMiddleware');
const { requireRole } = require('../../middlewares/roleMiddleware');

// @route   PUT /api/admin/wallet/bank-transfer/:id
router.put('/bank-transfer/:id', authMiddleware, requireRole('ADMIN'), reviewBankTransfer);

// @route   PUT /api/admin/wallet/refund/:id
router.put('/refund/:id', authMiddleware, requireRole('ADMIN'), reviewRefund);

module.exports = router;