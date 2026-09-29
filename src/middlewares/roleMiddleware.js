// src/middlewares/roleMiddleware.js

/**
 * middleware عام بيتحقق إنو المستخدم الحالي عنده وحدة من الأدوار المسموحة.
 * ⚠️ لازم يجي بعد authMiddleware بالسلسلة (محتاج req.user جاهز أصلاً).
 *
 * الاستخدام:
 *   router.put('/admin/...', protect, requireRole('ADMIN'), controller);
 *   router.post('/...', protect, requireRole('BRAND', 'ADMIN'), controller); // أكتر من دور مسموح
 *
 * @param {...string} allowedRoles - الأدوار المسموحة (مثلاً 'ADMIN', 'BRAND')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

module.exports = { requireRole };