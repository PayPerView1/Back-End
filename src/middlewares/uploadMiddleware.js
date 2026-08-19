// src/middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// مجلد تخزين الصور المرفوعة
const UPLOAD_DIR = path.join(__dirname, '../../uploads/profile-pictures');

// بننشئ المجلد تلقائيًا لو مش موجود
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// إعداد مكان وتسمية الملف المرفوع
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
   
    const identifier = req.user?._id || 'new-user';

    const uniqueSuffix = `${identifier}-${Date.now()}`;
    const ext = path.extname(file.originalname); // .jpg, .png...

    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// فلترة نوع الملف - نسمح بالصور بس
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

// middleware بيتعامل مع خطأ multer نفسه (نوع ملف غلط، حجم كبير...)
// ويحوله لصيغة JSON موحدة متل باقي أخطاء الـ API
const handleUploadError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // أخطاء multer المعروفة (حجم كبير، عدد ملفات...)
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
        // أخطاء fileFilter (نوع ملف غير مسموح)
        return res.status(400).json({
          success: false,
          errors: [{ field: 'profilePicture', message: err.message }],
        });
      }
      next();
    });
  };
};

// upload.single('profilePicture') → بيتوقع ملف واحد بحقل اسمه profilePicture
module.exports = handleUploadError(upload.single('profilePicture'));