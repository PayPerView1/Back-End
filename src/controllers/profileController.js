// src/controllers/profileController.js
const User = require('../models/user'); // عدّل المسار حسب مكان الملف عندك
const cloudinary = require('../config/cloudinary');
// @desc    جلب بيانات البروفايل الخاصة بالمستخدم الحالي
// @route   GET /api/profile
// @access  Private (لازم يكون فيه authMiddleware قبلها)
const getProfile = async (req, res) => {
  try {
    // req.user موجود أصلاً من authMiddleware، بس منجيبه من جديد
    // للتأكد إنو آخر نسخة محدّثة من الداتابيز
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(`Get Profile Error: ${error.message}`);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

// @desc    تعديل بيانات البروفايل الخاصة بالمستخدم الحالي
// @route   PUT /api/profile
// @access  Private (لازم يكون فيه authMiddleware قبلها)
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // بنحدد بس الحقول المسموح للمستخدم يعدلها
    // (متعمّدين ما نسمح بتعديل email أو role أو password من هون)
    const {
      fullName,
      username,
      phoneCountryCode,
      phoneNumber,
      country,
      city,
      profilePicture,
      interests,
      dateOfBirth,
      bio,
    } = req.body;

    if (fullName !== undefined) user.fullName = fullName;
    // لو المستخدم بعت username فاضي (""), نعتبره "إزالة" لليوزرنيم مش قيمة فعلية
    // عشان ما يتعارض مع unique index لو أكتر من مستخدم بعتوا فاضي بنفس الوقت
    if (username !== undefined) user.username = username ? username.toLowerCase() : undefined;
    if (phoneCountryCode !== undefined) user.phoneCountryCode = phoneCountryCode;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (country !== undefined) user.country = country;
    if (city !== undefined) user.city = city;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (bio !== undefined) user.bio = bio;

    // الاهتمامات: بتستبدل المصفوفة بالكامل بكل مرة (مش تراكمية)
    // يعني لو المستخدم بده يشيل اهتمام، الفرونت إند يبعت المصفوفة الجديدة بدونه
    if (interests !== undefined) user.interests = interests;

    // الصورة: إما ملف مرفوع فعليًا (req.file من multer) أو رابط نصي (profilePicture بالـ body)
    // الأولوية للملف المرفوع لو الاتنين وصلوا بنفس الطلب بالغلط
        if (req.file) {
      // إذا كان المستخدم يملك صورة قديمة على Cloudinary، نحذفها أولاً
      if (user.profilePicturePublicId) {
        try {
          await cloudinary.uploader.destroy(user.profilePicturePublicId);
        } catch (err) {
          console.error('Failed to delete old profile picture:', err);
        }
      }
      
      // حفظ الرابط الجديد والـ public_id
      user.profilePicture = req.file.path; // رابط Cloudinary
      user.profilePicturePublicId = req.file.filename; // public_id من Cloudinary
    } else if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        profilePicture: updatedUser.profilePicture,
        phoneCountryCode: updatedUser.phoneCountryCode,
        phoneNumber: updatedUser.phoneNumber,
        country: updatedUser.country,
        city: updatedUser.city,
        interests: updatedUser.interests,
        dateOfBirth: updatedUser.dateOfBirth,
        bio: updatedUser.bio,
      },
    });
  } catch (error) {
    // احتياط إضافي: لو صار تعارض تكرار على مستوى قاعدة البيانات نفسها
    // (حالة نادرة جدًا لو وصل طلبين بنفس اللحظة بالظبط بنفس username)
    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(400).json({
        success: false,
        errors: [{ field: 'username', message: 'This username is already taken' }],
      });
    }

    console.error(`Update Profile Error: ${error.message}`);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};