const multer = require('multer');
const path = require('path');
const fs = require('fs');

// مجلد تخزين الصور المرفوعة
const UPLOAD_DIR = path.join(__dirname, '../../uploads/profile-pictures');

// إنشاء المجلد تلقائيًا لو غير موجود
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// إعداد مكان وتسمية الملف المرفوع
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // 1. التأكد من وجود req.user وتحديد المعرف (ليدعم SignUp و Edit Profile)
    const identifier = req.user?._id || 'new-user';

    // 2. اسم فريد: identifier + وقت الرفع + الامتداد الأصلي
    const uniqueSuffix = `${identifier}-${Date.now()}`;
    const ext = path.extname(file.originalname); // .jpg, .png...

    // 3. إرجاع اسم الملف النهائي
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// فلترة نوع الملف - السماح بالصور فقط
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpeg, .jpg, .png and .webp images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // حد أقصى 5MB للصورة
  },
});

// Middleware معالجة أخطاء multer تحويلها لـ JSON موحد
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