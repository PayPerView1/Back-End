// src/routes/moderation/report.routes.js
// المالك: الشخص A — الإبلاغ والإشراف (API_CONTRACT_Sprint4.md §5)
// ⚠️ بلا router.use عام (POST /campaigns/:campaignId/report مفتوح للزوار عبر optionalAuth).
// ترتيب: /reports/confirm و /reports/statistics قبل /reports/:id
const express = require('express');
const router = express.Router();

// TODO(A): POST /campaigns/:campaignId/report   (optionalAuth + rate limiter)
// TODO(A): POST /reports/confirm                (PUBLIC)
// TODO(A): GET  /reports/statistics             (ADMIN)
// TODO(A): GET  /reports                        (ADMIN)
// TODO(A): GET  /reports/:id                    (ADMIN)
// TODO(A): PUT  /reports/:id                    (ADMIN)

module.exports = router;