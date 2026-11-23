const { rateLimit } = require('express-rate-limit');

const createAuthRateLimiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        message: 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً.',
        code: 'RATE_LIMIT_EXCEEDED',
      }),
  });

module.exports = { createAuthRateLimiter };
