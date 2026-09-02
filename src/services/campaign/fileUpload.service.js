// src/services/campaign/fileUpload.service.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { MATERIAL_CONSTRAINTS, MATERIAL_TYPE } = require('../../constants/campaign.constants');

// ⚠️ ملاحظة مهمة: تخزين محلي مؤقت (local disk) — قرار مؤقت لحد ما يتقرر حل نهائي
// (Render نظام ملفات مؤقت، يعني هالملفات ممكن تنمسح عند إعادة تشغيل السيرفر).
// لما يتقرر الحل النهائي (S3، أو خدمة تانية)، بس هالملف لازم يتغير — باقي الكود
// (validators, controllers, services) ما إله علاقة بمكان التخزين، فمش رح يتأثر.

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/campaign-materials');

// بننشئ المجلد تلقائيًا لو مش موجود
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================
// 2.1.2 فحص نوع الملف (MIME type)
// ============================================
function validateFileType(file) {
  return MATERIAL_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.mimetype);
}

// ============================================
// 2.1.3 فحص حجم الملف
// ============================================
function validateFileSize(file) {
  const maxSizeBytes = MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

// ============================================
// 2.1.4 فحص عدد الملفات
// ============================================
function validateFilesCount(files) {
  if (!Array.isArray(files)) return false;
  return files.length > 0 && files.length <= MATERIAL_CONSTRAINTS.MAX_FILES;
}

// ============================================
// 2.1.1 إعداد multer — diskStorage (تخزين محلي)
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // اسم فريد لكل ملف: UUID + timestamp + الامتداد الأصلي
    const uniqueName = `${uuidv4()}-${Date.now()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueName}${ext}`);
  },
});

// فلترة نوع الملف وقت الرفع مباشرة (قبل حتى ما يوصل للفحص اليدوي)
const fileFilter = (req, file, cb) => {
  if (validateFileType(file)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MATERIAL_CONSTRAINTS.MAX_FILES,
  },
});

/**
 * middleware جاهز للاستخدام مباشرة بالـ routes — بيرفع لحقل اسمه "materials"،
 * وبيحول أخطاء multer (نوع غلط، حجم كبير، عدد كبير) لصيغة JSON موحدة بدل
 * ما يرميها كـ exception غير معالج.
 */
const uploadMaterials = (req, res, next) => {
  const handler = multerUpload.array('materials', MATERIAL_CONSTRAINTS.MAX_FILES);

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `Each file must not exceed ${MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB}MB`,
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: `Cannot upload more than ${MATERIAL_CONSTRAINTS.MAX_FILES} files`,
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      // أخطاء fileFilter (نوع ملف غير مسموح)
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ============================================
// 2.1.7 تحويل MIME type إلى MATERIAL_TYPE enum
// ============================================
// ⚠️ LOGO و TEXT مش قابلين للاستنتاج من الـ mimetype لحاله (بيعتمدوا على قصد
// المستخدم وقت الرفع)، فهالدالة بترجع بس VIDEO / IMAGE / AUDIO / OTHER
function determineFileType(mimeType) {
  if (mimeType.startsWith('video/')) return MATERIAL_TYPE.VIDEO;
  if (mimeType.startsWith('image/')) return MATERIAL_TYPE.IMAGE;
  if (mimeType.startsWith('audio/')) return MATERIAL_TYPE.AUDIO;
  return MATERIAL_TYPE.OTHER;
}

// ============================================
// 2.1.5 "رفع" الملفات — تجهيز بياناتها لتنحفظ بالحملة
// ============================================
// ⚠️ الملفات هون أصلاً محفوظة على القرص من قبل multer (diskStorage) لحظة
// وصول الطلب — هالدالة بس بتحول شكل بيانات multer لشكل materialSchema بالظبط
/**
 * @param {Array} files - مصفوفة ملفات جاية من multer (req.files، كل وحدة فيها .filename, .path, .size...)
 * @returns {Array} مصفوفة { fileName, fileUrl, fileType, fileSizeKb, mimeType }
 */
function uploadFilesToStorage(files) {
  return files.map((file) => ({
    fileName: file.originalname,
    // رابط نسبي — مبني على نفس مسار الـ static serving المستخدم أصلاً لصور البروفايل
    // (app.use('/uploads', express.static(...))) بيغطي هالمجلد الفرعي تلقائيًا
    fileUrl: `/uploads/campaign-materials/${file.filename}`,
    fileType: determineFileType(file.mimetype),
    fileSizeKb: Math.round(file.size / 1024),
    mimeType: file.mimetype,
  }));
}

// ============================================
// 2.1.6 حذف ملفات (عند حذف الحملة)
// ============================================
/**
 * @param {Array<string>} fileUrls - مصفوفة الروابط النسبية المخزنة بالحملة (fileUrl)
 */
async function deleteFilesFromStorage(fileUrls) {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
    return;
  }

  for (const url of fileUrls) {
    try {
      // نحول الرابط النسبي لمسار فعلي بالقرص
      // مثال: /uploads/campaign-materials/xxx.mp4 → UPLOAD_DIR/xxx.mp4
      const fileName = path.basename(url);
      const filePath = path.join(UPLOAD_DIR, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // نفس فلسفة activityLog.service — فشل حذف ملف واحد ما لازم يوقف حذف الباقي
      console.error(`[fileUpload.service] Failed to delete file ${url}: ${error.message}`);
    }
  }
}

module.exports = {
  uploadMaterials,
  validateFileType,
  validateFileSize,
  validateFilesCount,
  uploadFilesToStorage,
  deleteFilesFromStorage,
  determineFileType,
};