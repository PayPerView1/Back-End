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

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT_SECRET is missing.',
      });
    }

    // 2. فك تشفير التوكن والتحقق من صحته
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. التأكد من أن المستخدم صاحب التوكن لا يزال موجوداً في قاعدة البيانات
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // الانتقال إلى الـ Controller التالي
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed or expired.',
    });
  }
};