// src/routes/ai/chat.routes.js

const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware'); // ✅ استخدام protect بدلاً من authenticateJWT
const rateLimiter = require('../../middlewares/ai/rateLimiter');
const chatController = require('../../controllers/ai/chat.controller');

// جميع الـ endpoints محمية بـ JWT و Rate Limiting
router.use(protect); // ✅ استخدام protect بدلاً من authenticateJWT
router.use(rateLimiter({ windowMs: 60 * 1000, max: 30 })); // 30 طلب في الدقيقة

// مسارات المحادثات - بنفس نمط مساراتك الحالية
router.post('/threads', chatController.createThread);
router.get('/threads', chatController.listThreads);
router.get('/threads/:threadId/messages', chatController.getMessages);
router.post('/threads/:threadId/messages', chatController.sendMessage);
router.delete('/threads/:threadId', chatController.deleteThread);

module.exports = router;