// src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();

const { getProfile, updateProfile } = require('../controllers/profileController');
const { protect: authMiddleware } = require('../middlewares/authMiddleware');

const { updateProfileRules, validate } = require('../validators/profileValidator');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

// كل المسارات هون محمية بـ authMiddleware
// يعني لازم يكون فيه توكن صحيح قبل ما توصل لأي واحد فيهم

// @route   GET /api/profile
// @desc    جلب بيانات البروفايل الخاصة بالمستخدم الحالي
router.get('/', authMiddleware, getProfile);

// @route   PUT /api/profile
// @desc    تعديل بيانات البروفايل الخاصة بالمستخدم الحالي
router.put('/', authMiddleware, uploadMiddleware, updateProfileRules, validate, updateProfile);

module.exports = router;