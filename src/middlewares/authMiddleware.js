// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
// import jwt from 'jsonwebtoken';
const User = require('../models/user'); 
// import User from '../models/user.js'; 

const authMiddleware = async (req, res, next) => {
  try {
    // 1. قراءة التوكن من الـ Authorization header
    // الصيغة المتوقعة: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];

    // 2. التحقق من صلاحية التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

    // 3. جلب بيانات المستخدم من قاعدة البيانات (بدون الباسورد)
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }  

    // 4. تخزين بيانات المستخدم بالـ request عشان نستخدمها بالكونترولر
    req.user = user;

    next();
  } catch (error) {
    console.error(`Auth Error: ${error.message}`);
    return res.status(401).json({ message: 'Not authorized, token failed or expired' });
  }
};

module.exports = authMiddleware;