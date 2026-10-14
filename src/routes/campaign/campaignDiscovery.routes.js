// src/routes/campaign/campaignDiscovery.routes.js
// المالك: الشخص B — الاكتشاف والتفاصيل والتوصيات (API_CONTRACT_Sprint4.md §1, §2.1)
// ⚠️ قواعد هذا الملف:
//  - لا تستعمل router.use(protect, ...) عاماً؛ ضع الـ middleware على كل route على حدة
//    (هذا الـ router مُركَّب على /api/v1 قبل campaignBudgetRoutes).
//  - المسارات الثابتة أولاً: /campaigns/discover/suggestions ثم /campaigns/discover
//    ثم /campaigns/recommendations ثم /campaigns/:campaignId/details
const express = require('express');
const router = express.Router();

// TODO(B): GET /campaigns/discover/suggestions
// TODO(B): GET /campaigns/discover
// TODO(B): GET /campaigns/recommendations
// TODO(B): GET /campaigns/:campaignId/details

module.exports = router;