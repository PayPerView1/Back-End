// src/middlewares/submission/submissionRateLimiter.js
// حد طلبات "فحص الرابط": كل طلب قد يستدعي خدمات خارجية (oEmbed / YouTube API / حل الروابط المختصرة)،
// فنحمي الحصة ونمنع إساءة الاستعمال.
//
// ⚠️ يجب أن يأتي بعد protect في سلسلة الـ route (يقرأ req.user).
// المفتاح: المستخدم المسجّل، وإن غاب (لا يُفترض) فعنوان الـ IP.
//   - للـ IP يحتاج app.set('trust proxy', 1) في app.js على Render (انظر ملاحظة reportRateLimiter).
// الـ store في الذاكرة (نسخة واحدة من السيرفر)، ويُصفَّر عند إعادة التشغيل.
//
// الإعداد من .env (اختياري): VERIFY_LINK_RATE_LIMIT (افتراضي 20 طلباً)، VERIFY_LINK_RATE_WINDOW_SECONDS (افتراضي 60)
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const tooManyChecks = {
  success: false,
  message: 'Too many link checks. Please wait a minute and try again.',
  code: 'TOO_MANY_REQUESTS',
};

/** مصنع لتسهيل الاختبار (حدّ صغير). الاستعمال الفعلي: verifyLinkRateLimiter أدناه */
const createVerifyLinkRateLimiter = ({ limit, windowMs } = {}) =>
  rateLimit({
    windowMs: windowMs || toInt(process.env.VERIFY_LINK_RATE_WINDOW_SECONDS, 60) * 1000,
    limit: limit || toInt(process.env.VERIFY_LINK_RATE_LIMIT, 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyChecks,
    // نفس شكل أخطاء العقد
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    },
    // ⚠️ في express-rate-limit v8 تأخذ ipKeyGenerator نص الـ IP (req.ip) وليس req
    keyGenerator: (req) =>
      req.user && req.user._id ? `user:${req.user._id.toString()}` : `ip:${ipKeyGenerator(req.ip)}`,
  });

const verifyLinkRateLimiter = createVerifyLinkRateLimiter();

module.exports = { verifyLinkRateLimiter, createVerifyLinkRateLimiter };