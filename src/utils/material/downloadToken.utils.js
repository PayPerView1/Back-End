// src/utils/material/downloadToken.utils.js
// رابط التنزيل الموقّع: JWT (HS256) قصير العمر بسرّ مستقل DOWNLOAD_LINK_SECRET (وليس JWT_SECRET).
// الحمولة لا تحوي إلا: lid (سجل التنزيل) و uid (المبدع). لا مسارات ملفات ولا روابط Cloudinary.
//
//   signDownloadToken({ logId, creatorId, ttlSeconds? }) -> { token, expiresAt: Date }
//   verifyDownloadToken(token)                           -> { logId, creatorId }   (نصوص)
//   buildDownloadUrl(token)                              -> رابط مطلق (BACKEND_URL) أو نسبي إن لم يُضبط
//
// أخطاء التحقق: منتهي => DOWNLOAD_LINK_EXPIRED (410)، وأي شيء آخر => FORBIDDEN (403).
// غياب السرّ خطأ إعداد (Error عادي => 500)، ويُفحص عند الاستدعاء وليس عند الاستيراد.
//
// يستعمل المبدع نفسه JWT الدخول العادي مع هذا الرابط (قرار D2): الرابط وحده لا يكفي.
const jwt = require('jsonwebtoken');
const { AppError } = require('../errors');
const { SUBMISSION_CONFIG } = require('../../constants/submission.constants');

const ALGORITHM = 'HS256';
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const getSecret = () => {
  const secret = process.env.DOWNLOAD_LINK_SECRET;
  if (!secret) throw new Error('DOWNLOAD_LINK_SECRET is not configured');
  return secret;
};

const expired = () => new AppError('Download link expired', 'DOWNLOAD_LINK_EXPIRED');
const invalid = () => new AppError('Invalid download link', 'FORBIDDEN');

const signDownloadToken = ({ logId, creatorId, ttlSeconds } = {}) => {
  const lid = String(logId);
  const uid = String(creatorId);
  if (!OBJECT_ID.test(lid) || !OBJECT_ID.test(uid)) {
    throw new Error('signDownloadToken: logId and creatorId must be valid ObjectIds');
  }

  const ttl = ttlSeconds === undefined ? SUBMISSION_CONFIG.DOWNLOAD_LINK_TTL_SECONDS : ttlSeconds;
  if (!Number.isFinite(ttl)) throw new Error('signDownloadToken: ttlSeconds must be a finite number');

  // jsonwebtoken يتطلب عدداً صحيحاً لـ expiresIn
  const token = jwt.sign({ lid, uid }, getSecret(), { algorithm: ALGORITHM, expiresIn: Math.trunc(ttl) });
  const { exp } = jwt.decode(token);

  return { token, expiresAt: new Date(exp * 1000) };
};

const verifyDownloadToken = (token) => {
  const secret = getSecret();

  let payload;
  try {
    // algorithms محصورة بـ HS256 (يمنع alg:none وتبديل الخوارزمية)
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch (error) {
    // التوقيع يُفحص قبل الانتهاء: توكن مزوَّر ومنتهٍ يعطي FORBIDDEN وليس EXPIRED
    if (error && error.name === 'TokenExpiredError') throw expired();
    throw invalid();
  }

  const lid = payload && payload.lid;
  const uid = payload && payload.uid;
  if (typeof lid !== 'string' || typeof uid !== 'string' || !OBJECT_ID.test(lid) || !OBJECT_ID.test(uid)) {
    throw invalid();
  }

  return { logId: lid, creatorId: uid };
};

const buildDownloadUrl = (token) => {
  const base = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
  return `${base}/api/v1/materials/download/${token}`;
};

module.exports = { signDownloadToken, verifyDownloadToken, buildDownloadUrl };