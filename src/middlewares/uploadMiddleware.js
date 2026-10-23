const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); // تأكد من مسار الإعدادات

// 1. إعداد التخزين على Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile-pictures', // اسم المجلد في Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
    public_id: (req, file) => {
      const identifier = req.user?._id || 'new-user';
      return `${identifier}-${Date.now()}`;
    },
  },
});

// 2. فلترة نوع الملف - السماح بالصور فقط
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpeg, .jpg, .png and .webp images are allowed'), false);
  }
};

// 3. إعداد multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // حد أقصى 5MB للصورة
  },
});

// 4. Middleware لمعالجة الأخطاء
const handleUploadError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            errors: [{ field: 'profilePicture', message: 'Image size must not exceed 5MB' }],
          });
        }
        return res.status(400).json({
          success: false,
          errors: [{ field: 'profilePicture', message: err.message }],
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'profilePicture', message: err.message }],
        });
      }
      next();
    });
  };
};

module.exports = handleUploadError(upload.single('profilePicture'));