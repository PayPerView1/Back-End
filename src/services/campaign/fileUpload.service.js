// src/services/campaign/fileUpload.service.js
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../../config/cloudinary');
const { MATERIAL_CONSTRAINTS, MATERIAL_TYPE } = require('../../constants/campaign.constants');

// ============================================
// 2.1.2 Validate File Type (MIME type)
// ============================================
function validateFileType(file) {
  return MATERIAL_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.mimetype);
}

// ============================================
// 2.1.3 Validate File Size
// ============================================
function validateFileSize(file) {
  const maxSizeBytes = MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

// ============================================
// 2.1.4 Validate Files Count
// ============================================
function validateFilesCount(files) {
  if (!Array.isArray(files)) return false;
  return files.length > 0 && files.length <= MATERIAL_CONSTRAINTS.MAX_FILES;
}

// ============================================
// 2.1.1 Configure Multer — Materials (CloudinaryStorage) + Cover (memoryStorage)
// ============================================

function sanitizeName(name) {
  return (name || 'file')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);
}

const materialsStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'campaign-materials',
      resource_type: 'auto',
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeName(path.parse(file.originalname).name)}`,
    };
  },
});

const materialsFileFilter = (req, file, cb) => {
  if (validateFileType(file)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

// const materialsUploadMw = multer({
//   storage: materialsStorage,
//   fileFilter: materialsFileFilter,
//   limits: {
//     fileSize: MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024,
//     files: MATERIAL_CONSTRAINTS.MAX_FILES,
//   },
// }).array('materials', MATERIAL_CONSTRAINTS.MAX_FILES);

// const coverImageUploadMw = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB للـ cover
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype.startsWith('image/')) cb(null, true);
//     else cb(new Error('Cover image must be an image file'), false);
//   },
// }).single('coverImage');

const uploadMaterials = (req, res, next) => {
  const upload = multer({
    storage: multer.memoryStorage(), // نخزن في الذاكرة مؤقتاً
    limits: {
      fileSize: MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: MATERIAL_CONSTRAINTS.MAX_FILES + 1, // +1 للـ coverImage
    },
  }).fields([
    { name: 'materials', maxCount: MATERIAL_CONSTRAINTS.MAX_FILES },
    { name: 'coverImage', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) {
      console.error('[Multer Error]:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: `File too large. Max ${MATERIAL_CONSTRAINTS.MAX_FILE_SIZE_MB}MB` });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

function handleMulterError(err, res) {
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
  }
  return res.status(400).json({ success: false, message: err.message });
}

// ============================================
// 2.1.7 Determine MATERIAL_TYPE enum
// ============================================
function determineFileType(mimeType) {
  if (mimeType.startsWith('video/')) return MATERIAL_TYPE.VIDEO;
  if (mimeType.startsWith('image/')) return MATERIAL_TYPE.IMAGE;
  if (mimeType.startsWith('audio/')) return MATERIAL_TYPE.AUDIO;
  return MATERIAL_TYPE.OTHER;
}

// ============================================
// 2.1.5 Upload Files — Format metadata
// ============================================
async function uploadFilesToStorage(files) {
  if (!files || files.length === 0) return [];

  const uploadedMaterials = [];
  for (const file of files) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'campaign-materials',
          resource_type: 'auto',
          public_id: `${Date.now()}-${path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });

    uploadedMaterials.push({
      fileName: file.originalname,
      fileUrl: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      fileType: file.mimetype.startsWith('video/') ? 'VIDEO' : file.mimetype.startsWith('image/') ? 'IMAGE' : file.mimetype.startsWith('audio/') ? 'AUDIO' : 'OTHER',
      fileSizeKb: Math.round(file.size / 1024),
      mimeType: file.mimetype,
    });
  }
  return uploadedMaterials;
}

// ============================================
// Helper to extract Cloudinary public_id from URL
// ============================================
function getPublicIdFromUrl(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    const parts = url.split('/');
    const folderIndex = parts.findIndex(
      (p) => p === 'campaign-materials' || p === 'campaign-covers'
    );
    if (folderIndex === -1) return null;
    const pathWithExt = parts.slice(folderIndex).join('/');
    return pathWithExt.substring(0, pathWithExt.lastIndexOf('.'));
  } catch {
    return null;
  }
}

// ============================================
// 2.1.6 دالة الحذف من Cloudinary
// ============================================
async function deleteFilesFromStorage(items) {
  if (!items || items.length === 0) return;
  for (const item of items) {
    try {
      if (item.publicId) {
        await cloudinary.uploader.destroy(item.publicId, { resource_type: item.resourceType || 'image' });
      }
    } catch (error) {
      console.error(`[fileUpload.service] Delete error:`, error.message);
    }
  }
}

/**
 * @param {Array<{publicId:string, resourceType:string}|string>} items
 *        إما objects ({publicId, resourceType}) أو URLs (legacy)
 */
async function deleteFilesFromStorage(items) {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    try {
      let publicId, resourceType;
      if (typeof item === 'string') {
        publicId = getPublicIdFromUrl(item);
        resourceType = 'auto'; // fallback — رح نحاول resource_type الافتراضي
      } else {
        publicId = item.publicId;
        resourceType = item.resourceType || 'auto';
      }
      if (!publicId) continue;

      // Cloudinary destroy مبيحبش 'auto' دائمًا — نجرّب الأنواع بالترتيب
      if (resourceType === 'auto') {
        const types = ['image', 'video', 'raw'];
        let deleted = false;
        for (const t of types) {
          try {
            const r = await cloudinary.uploader.destroy(publicId, { resource_type: t });
            if (r.result === 'ok' || r.result === 'not_found') { deleted = true; break; }
          } catch (_) { /* جرّب النوع اللي بعده */ }
        }
        if (!deleted) {
          console.warn(`[fileUpload.service] Could not destroy ${publicId} (auto)`);
        }
      } else {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      }
    } catch (error) {
      console.error(`[fileUpload.service] Failed to delete file:`, error.message);
    }
  }
}

// ============================================
// 3.0.0 Upload Cover Image
// ============================================
async function uploadCoverImage(file) {
  if (!file || !file.buffer) return null;
  
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'campaign-covers',
        resource_type: 'image',
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: 'image',
        });
      }
    );
    stream.end(file.buffer);
  });
}

module.exports = {
  uploadMaterials,
  validateFileType,
  validateFileSize,
  validateFilesCount,
  uploadFilesToStorage,
  deleteFilesFromStorage,
  determineFileType,
  uploadCoverImage,
};