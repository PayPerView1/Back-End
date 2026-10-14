// src/routes/notification/notification.routes.js
// المالك: الشخص A — الإشعارات (API_CONTRACT_Sprint4.md §6)
// مُركَّب في app.js على /api/v1/notifications ← المسارات هنا نسبية.
// كل المسارات تحتاج protect فقط (أي دور) → router.use(protect) مسموح هنا.
// ترتيب: /unread-count و /read-all قبل /:id/read
const express = require('express');
const router = express.Router();

// TODO(A): GET   /               ← القائمة
// TODO(A): GET   /unread-count
// TODO(A): PATCH /read-all
// TODO(A): PATCH /:id/read

module.exports = router;