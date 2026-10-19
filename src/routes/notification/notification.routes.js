// src/routes/notification/notification.routes.js
// المالك: الشخص A — الإشعارات (API_CONTRACT_Sprint4.md §6)
// مُركَّب في app.js على /api/v1/notifications ← المسارات هنا نسبية.
// كل المسارات تحتاج protect فقط (أي دور) → router.use(protect) مسموح هنا.
// ترتيب: /unread-count و /read-all قبل /:id/read
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const {
  validateListNotifications,
  validateNotificationId,
  validate
} = require('../../validators/notification/notification.validator');
const {
  listNotifications,
  getUnreadCountHandler,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('../../controllers/notification/notification.controller');



router.use(protect);

router.get('/', validateListNotifications, validate, listNotifications);
router.get('/unread-count', getUnreadCountHandler);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', validateNotificationId, validate, markNotificationAsRead);

module.exports = router;