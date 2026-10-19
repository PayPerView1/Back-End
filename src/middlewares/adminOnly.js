// src/middlewares/adminOnly.js
// ⚠️ يجب أن يأتي بعد protect دائماً: router.get('/x', protect, adminOnly, handler)
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please log in.',
      code: 'UNAUTHORIZED',
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.',
      code: 'FORBIDDEN',
    });
  }

  next();
};

module.exports = adminOnly;