// src/utils/campaign/materialPreview.utils.js
// المالك: الشخص B — يُستخدم في Campaign Details (لاكتشاف).
//
// الوظيفة: بناء رابط معاينة (preview) آمن لملف مادة مصدرية (material)
// عبر حقن تحويلات Cloudinary في الرابط الأصلي، بدون كشف الـ fileUrl الأصلي.
//
// ⚠️ القاعدة الأساسية: لا يُرجع fileUrl الأصلي لغير المقبولين أبداً.
// - VIDEO: جودة منخفضة + اقتطاع أول ~15 ثانية + عرض مصغّر
// - IMAGE: عرض مصغّر + جودة منخفضة
// - AUDIO / PDF / OTHER: previewUrl = null (يُعرض الاسم والحجم فقط)

/**
 * يفحص إذا كان الرابط رابط Cloudinary قابلاً للتحويل.
 */
const isCloudinaryUrl = (url) =>
  typeof url === 'string' &&
  /res\.cloudinary\.com\/.+\/(upload|video\/upload)\//.test(url);

/**
 * يحقن سلسلة التحويلات (transformation) بعد `/upload/` مباشرة.
 */
const injectTransformation = (url, transformation) => {
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return (
    url.slice(0, idx + marker.length) +
    transformation +
    '/' +
    url.slice(idx + marker.length)
  );
};

/**
 * يبني رابط معاينة آمن للمادة المصدرية.
 * @param {{ fileUrl: string, fileType: string }} material
 * @returns {string|null}
 */
const buildPreviewUrl = (material) => {
  if (!material || !material.fileUrl || !material.fileType) return null;

  if (material.fileType !== 'VIDEO' && material.fileType !== 'IMAGE') {
    return null;
  }

  if (!isCloudinaryUrl(material.fileUrl)) {
    return null;
  }

  if (material.fileType === 'VIDEO') {
    const transformation = 'w_480,q_auto:low,so_0,du_15';
    return injectTransformation(material.fileUrl, transformation);
  }

  if (material.fileType === 'IMAGE') {
    const transformation = 'w_480,q_auto:low';
    return injectTransformation(material.fileUrl, transformation);
  }

  return null;
};

/**
 * يبني كائن material للمعاينة (بدون fileUrl الأصلي).
 */
const toPreviewMaterial = (material) => ({
  id: material._id,
  fileName: material.fileName,
  fileType: material.fileType,
  mimeType: material.mimeType,
  fileSizeKb: material.fileSizeKb,
  previewUrl: buildPreviewUrl(material),
});

module.exports = {
  buildPreviewUrl,
  toPreviewMaterial,
  isCloudinaryUrl,
};