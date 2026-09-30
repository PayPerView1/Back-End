// src/middlewares/wallet/receiptUpload.middleware.js

const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../../config/cloudinary');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// ----------------------
// Cloudinary Storage — مجلد منفصل للإيصالات
// ----------------------
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'bank-transfer-receipts',
    resource_type: 'auto',
    public_id: `receipt-${Date.now()}-${path.parse(file.originalname).name}`,
  }),
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: jpg, png, pdf'), false);
  }
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

// ----------------------
// Middleware مع معالجة الأخطاء
// ----------------------
const uploadReceipt = (req, res, next) => {
  const handler = multerUpload.single('receipt');

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds 5MB limit',
          code: 'VALIDATION_ERROR',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'VALIDATION_ERROR',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'VALIDATION_ERROR',
      });
    }
    next();
  });
};

module.exports = uploadReceipt;