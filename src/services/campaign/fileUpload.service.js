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
// 2.1.1 Configure Multer with Cloudinary Storage
// ============================================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'campaign-materials',
      resource_type: 'auto',
      public_id: `${Date.now()}-${path.parse(file.originalname).name}`,
    };
  },
});

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
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

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
function uploadFilesToStorage(files) {
  return files.map((file) => ({
    fileName: file.originalname,
    fileUrl: file.path || file.secure_url,
    fileType: determineFileType(file.mimetype),
    fileSizeKb: Math.round(file.size / 1024),
    mimeType: file.mimetype,
  }));
}

// ============================================
// Helper to extract Cloudinary public_id from URL
// ============================================
function getPublicIdFromUrl(url) {
  try {
    const parts = url.split('/');
    const folderIndex = parts.indexOf('campaign-materials');
    if (folderIndex === -1) return null;

    // Extract folder + filename without file extension
    const pathWithExt = parts.slice(folderIndex).join('/');
    return pathWithExt.substring(0, pathWithExt.lastIndexOf('.'));
  } catch (error) {
    return null;
  }
}

// ============================================
// 2.1.6 Delete Files from Cloudinary
// ============================================
async function deleteFilesFromStorage(fileUrls) {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
    return;
  }

  for (const url of fileUrls) {
    try {
      const publicId = getPublicIdFromUrl(url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
      }
    } catch (error) {
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