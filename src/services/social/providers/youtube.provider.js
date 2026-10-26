// src/services/social/providers/youtube.provider.js
// جلب بيانات فيديو يوتيوب عبر YouTube Data API v3 (يحتاج YOUTUBE_API_KEY):
//   GET https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=<id>&key=<key>
// الاستهلاك: وحدة حصة واحدة لكل طلب (الحصة اليومية الافتراضية تكفي آلاف الطلبات).
//
// ⚠️ مبني على معرفتي بالـ API وقت الكتابة ولم يُجرَّب على الشبكة هنا. تحقق يدوياً (A1.4).
// ⚠️ لا نسجّل رابط الطلب أبداً: يحتوي المفتاح في الـ query string.
//
// ملاحظات:
//  - الفيديو الخاص أو المحذوف يرجع items فارغة، فلا يمكن التفريق بينهما: نرجع NOT_FOUND.
//  - handle القناة (@name) يحتاج طلباً ثانياً (channels)، فنتركه فارغاً في الـ MVP.
//  - الوصف (description) يُضم للعنوان لأن الهاشتاقات غالباً في آخر الوصف.
const axios = require('axios');
const { POST_FETCH_STATUS } = require('../../../constants/submission.constants');

const API_URL = 'https://www.googleapis.com/youtube/v3/videos';
const REQUEST_TIMEOUT_MS = 6000;

let warnedMissingKey = false;

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** PT1M2S / PT42S / PT1H2M3S / P0D  ->  ثوانٍ (null إن لم يُفهم) */
const parseIsoDuration = (iso) => {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso || '');
  if (!match || match.slice(1).every((part) => part === undefined)) return null;
  const [days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part || 0));
  return Math.round(days * 86400 + hours * 3600 + minutes * 60 + seconds);
};

const bestThumbnail = (thumbnails = {}) =>
  ['maxres', 'standard', 'high', 'medium', 'default']
    .map((size) => thumbnails[size] && thumbnails[size].url)
    .find(Boolean) || '';

const mapVideo = (video) => {
  const snippet = video.snippet || {};
  const details = video.contentDetails || {};
  const statistics = video.statistics || {};

  return {
    fetchStatus: POST_FETCH_STATUS.OK,
    caption: [snippet.title, snippet.description].filter(Boolean).join('\n'),
    authorName: snippet.channelTitle || '',
    authorHandle: '',
    authorUrl: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : '',
    thumbnailUrl: bestThumbnail(snippet.thumbnails),
    durationSec: parseIsoDuration(details.duration),
    publishedAt: snippet.publishedAt || null,
    stats: {
      views: toNumber(statistics.viewCount),
      likes: toNumber(statistics.likeCount), // قد يغيب إن أخفى صاحب القناة الإعجابات
      comments: toNumber(statistics.commentCount),
      shares: null, // غير متاح
    },
  };
};

const fetchPost = async ({ externalId }) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      console.warn('[youtube.provider] YOUTUBE_API_KEY is not set: YouTube posts cannot be verified');
      warnedMissingKey = true;
    }
    return { fetchStatus: POST_FETCH_STATUS.UNAVAILABLE };
  }

  let response;
  try {
    response = await axios.get(API_URL, {
      params: { part: 'snippet,contentDetails,statistics', id: externalId, key },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
  } catch (error) {
    console.error(`[youtube.provider] request failed: ${error.message}`);
    return { fetchStatus: POST_FETCH_STATUS.UNAVAILABLE };
  }

  const { status, data } = response;

  if (status !== 200) {
    // 400 مفتاح غير صالح، 403 حصة منتهية أو API غير مفعّل، 5xx عطل. المنشور نفسه غير مدان.
    const reason = data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
    console.error(`[youtube.provider] HTTP ${status}${reason ? ` (${reason})` : ''}`);
    return { fetchStatus: POST_FETCH_STATUS.UNAVAILABLE };
  }

  const items = data && data.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { fetchStatus: POST_FETCH_STATUS.NOT_FOUND };
  }

  return mapVideo(items[0]);
};

module.exports = { fetchPost, mapVideo, parseIsoDuration };