// src/routes/creator/favorite.routes.js
// المالك: الشخص B — المفضلة (API_CONTRACT_Sprint4.md §3)
// مُركَّب في app.js على /api/v1/favorites ← المسارات هنا نسبية (/ و /bulk-delete و /:id).
// كل المسارات تحتاج CLIPPER فقط، فيمكنك استعمال router.use(protect, requireClipperRole) هنا.
// ترتيب: /bulk-delete قبل /:id
const express = require('express');
const router = express.Router();

// TODO(B): POST   /              ← إضافة (idempotent)
// TODO(B): GET    /              ← القائمة
// TODO(B): POST   /bulk-delete
// TODO(B): DELETE /:id

module.exports = router;