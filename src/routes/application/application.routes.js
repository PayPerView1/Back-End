// src/routes/application/application.routes.js
// المالك: الشخص B — التقديم (API_CONTRACT_Sprint4.md §4)
// ⚠️ بلا router.use عام. المسارات الثابتة أولاً (/applications/my قبل /applications/:id).
const express = require('express');
const router = express.Router();

// TODO(B): POST   /campaigns/:campaignId/apply                (CLIPPER)
// TODO(B): GET    /campaigns/:campaignId/applications         (BRAND + verifyCampaignOwnership)
// TODO(B): GET    /applications/my                            (CLIPPER)
// TODO(B): GET    /applications/:id/materials                 (CLIPPER)
// TODO(B): PUT    /applications/:id/status                    (BRAND)
// TODO(B): DELETE /applications/:id                           (CLIPPER)

module.exports = router;