// src/routes/ai/chat.routes.js

const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware'); // ✅ استخدام protect بدلاً من authenticateJWT
const rateLimiter = require('../../middlewares/ai/rateLimiter');
const chatController = require('../../controllers/ai/chat.controller');
const { validate } = require('../../middlewares/validate.middleware');
const {
  threadIdParamsSchema,
  messageParamsSchema,
  createThreadBodySchema,
  sendMessageBodySchema,
  messageFeedbackBodySchema,
} = require('../../validators/ai/chat.validator');

// جميع الـ endpoints محمية بـ JWT و Rate Limiting
router.use(protect); // ✅ استخدام protect بدلاً من authenticateJWT
router.use(rateLimiter({ windowMs: 60 * 1000, max: 30 })); // 30 طلب في الدقيقة

// مسارات المحادثات - بنفس نمط مساراتك الحالية
router.post('/threads', validate({ body: createThreadBodySchema }), chatController.createThread);
router.get('/threads', chatController.listThreads);
router.get('/threads/:threadId/messages', validate({ params: threadIdParamsSchema }), chatController.getMessages);
router.post(
  '/threads/:threadId/messages',
  validate({ params: threadIdParamsSchema, body: sendMessageBodySchema }),
  chatController.sendMessage
);
router.patch(
  '/threads/:threadId/messages/:messageId/feedback',
  validate({ params: messageParamsSchema, body: messageFeedbackBodySchema }),
  chatController.submitFeedback
);
router.delete('/threads/:threadId', validate({ params: threadIdParamsSchema }), chatController.deleteThread);

module.exports = router;
