// src/middlewares/moderation/reportRateLimiter.js
// حد البلاغات: لكل IP (دائماً) ولكل مستخدم مسجّل (إضافياً)، كما يطلب العقد §5.1.
//
// ⚠️ يجب أن يأتي بعد optionalAuth في سلسلة الـ route (ليقرأ req.user).
// ⚠️ يحتاج app.set('trust proxy', 1) في app.js على Render، وإلا يرى كل الزوار عنوان الـ proxy نفسه
//    فيُحجبون معاً.
// ملاحظة: الـ store الافتراضي في الذاكرة (نسخة واحدة من السيرفر)؛ يُصفَّر عند كل إعادة تشغيل.
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const tooManyReports = {
  success: false,
  message: 'Too many reports. Please try again later.',
  code: 'TOO_MANY_REQUESTS',
};

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  // نرجع نفس شكل أخطاء العقد
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
};

// 1) لكل IP: يحمي من الزائر ومن تعدد الحسابات من نفس الشبكة
const reportIpLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  limit: 10,
  message: tooManyReports,
  // ⚠️ في express-rate-limit v8 تأخذ ipKeyGenerator نص الـ IP (req.ip) وليس req.
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
});

// 2) لكل مستخدم مسجّل: سقف يومي يمنع حساباً واحداً من إيقاف حملات كثيرة
const reportUserLimiter = rateLimit({
  ...baseOptions,
  windowMs: 24 * 60 * 60 * 1000, // 24 ساعة
  limit: 20,
  message: tooManyReports,
  skip: (req) => !(req.user && req.user._id), // الزائر يكفيه حد الـ IP
  keyGenerator: (req) => `user:${req.user._id.toString()}`,
});

// middleware واحد يطبّق الحدّين بالترتيب (نفس اسم التصدير السابق، فلا تغيير في الـ routes)
const reportRateLimiter = (req, res, next) =>
  reportIpLimiter(req, res, (err) => {
    if (err) return next(err);
    return reportUserLimiter(req, res, next);
  });

module.exports = { reportRateLimiter, reportIpLimiter, reportUserLimiter };