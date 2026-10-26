// src/services/social/socialMetadata.service.js
// ينسّق مزودي المنصات ويضمن أن النتيجة دائماً بشكل postMeta وأن الدالة لا ترمي أبداً.
//
// التوقيع المتفق عليه:
//   fetchPostMetadata({ platform, canonicalUrl, externalId }) -> postMeta (يحتوي fetchStatus دائماً)
//
// قرارات الاستدعاء (في خدمة التسليم):
//   fetchStatus NOT_FOUND    -> رمي INVALID_LINK مع details.httpStatus = 404
//   fetchStatus PRIVATE      -> رمي POST_NOT_PUBLIC
//   fetchStatus UNAVAILABLE  -> المتابعة (found = null في الفحوصات، والـ AI/اليدوي يقرر)
const { PLATFORM, POST_FETCH_STATUS } = require('../../constants/submission.constants');

const providers = {
  [PLATFORM.TIKTOK]: require('./providers/tiktok.provider'),
  [PLATFORM.YOUTUBE]: require('./providers/youtube.provider'),
  [PLATFORM.INSTAGRAM]: require('./providers/instagram.provider'),
};

const getTimeoutMs = () => Number(process.env.SOCIAL_FETCH_TIMEOUT_MS) || 8000;

const str = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const num = (value) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null);

const emptyMeta = (fetchStatus) => ({
  fetchStatus,
  caption: '',
  authorName: '',
  authorHandle: '',
  authorUrl: '',
  thumbnailUrl: '',
  durationSec: null,
  publishedAt: null,
  stats: null,
  fetchedAt: new Date(),
});

const normalizeStats = (stats) => {
  if (!stats || typeof stats !== 'object') return null;
  const result = {
    views: num(stats.views),
    likes: num(stats.likes),
    comments: num(stats.comments),
    shares: num(stats.shares),
  };
  return Object.values(result).every((v) => v === null) ? null : result;
};

const normalizeMeta = (data) => {
  const status = Object.values(POST_FETCH_STATUS).includes(data && data.fetchStatus)
    ? data.fetchStatus
    : POST_FETCH_STATUS.UNAVAILABLE;
  if (status !== POST_FETCH_STATUS.OK) return emptyMeta(status);

  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
  return {
    fetchStatus: status,
    caption: str(data.caption, 5000),
    authorName: str(data.authorName, 200),
    authorHandle: str(data.authorHandle, 100),
    authorUrl: str(data.authorUrl, 500),
    thumbnailUrl: str(data.thumbnailUrl, 1000),
    durationSec: num(data.durationSec),
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    stats: normalizeStats(data.stats),
    fetchedAt: new Date(),
  };
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SOCIAL_FETCH_TIMEOUT')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const fetchPostMetadata = async ({ platform, canonicalUrl, externalId }) => {
  const provider = providers[platform];
  if (!provider) return emptyMeta(POST_FETCH_STATUS.UNAVAILABLE);

  try {
    const data = await withTimeout(provider.fetchPost({ canonicalUrl, externalId }), getTimeoutMs());
    return normalizeMeta(data);
  } catch (error) {
    console.error(`[socialMetadata] ${platform} fetch failed: ${error.message}`);
    return emptyMeta(POST_FETCH_STATUS.UNAVAILABLE);
  }
};

module.exports = { fetchPostMetadata, normalizeMeta, withTimeout };