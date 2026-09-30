const adminOnly = (req, res, next) => {
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