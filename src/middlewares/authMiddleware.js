// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.protect = async (req, res, next) => {
  let token;

  // 1. التحقق من وجود التوكن في Header الطلب (Authorization: Bearer <token>)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // إذا لم يتم إرسال التوكن
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Token missing.',
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Authentication service is unavailable.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed or expired.',
    });
  }

  let user;
  try {
    user = await User.findById(decoded.id).select('+tokenVersion');
  } catch (error) {
    console.error('[AUTH] user lookup failed:', error.name || 'DatabaseError');
    return res.status(500).json({
      success: false,
      message: 'Authentication service is temporarily unavailable.',
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'The user belonging to this token no longer exists.',
    });
  }

  if ((decoded.ver || 0) !== (user.tokenVersion || 0)) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed or expired.',
    });
  }

  req.user = user;
  return next();
};

// يضع req.user إن وُجد توكن صالح، وإلا يكمل كزائر بدون رفض الطلب
exports.optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) return next();

  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+tokenVersion');
    if (user && (decoded.ver || 0) === (user.tokenVersion || 0)) req.user = user;
  } catch (error) {
    // توكن منتهٍ أو غير صالح → يُعامل كزائر
  }
  next();
};
