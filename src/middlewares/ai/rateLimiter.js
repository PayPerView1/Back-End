// src/middlewares/ai/rateLimiter.js
const rateLimit = require('express-rate-limit');

/**
 * Middleware لتحديد عدد الطلبات المسموحة
 * @param {Object} options - خيارات التحديد
 * @param {number} options.windowMs - مدة النافذة بالمللي ثانية (افتراضي: 1 دقيقة)
 * @param {number} options.max - الحد الأقصى للطلبات (افتراضي: 30)
 * @param {string} options.message - رسالة الخطأ
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 دقيقة
    max = 30, // 30 طلب
    message = 'لقد تجاوزت الحد المسموح من الطلبات. الرجاء المحاولة بعد دقيقة.',
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message,
    },
    standardHeaders: true, // إرجاع معلومات الـ Rate Limit في الـ Headers
    legacyHeaders: false,
    keyGenerator: (req) => {
      // استخدام معرف المستخدم إذا كان موجوداً، وإلا استخدام الـ IP
      return req.user?._id?.toString() || req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message,
      });
    },
  });
};

module.exports = rateLimiter;