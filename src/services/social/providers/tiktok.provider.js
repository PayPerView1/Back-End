// src/services/social/providers/tiktok.provider.js
// جلب بيانات منشور تيك توك عبر oEmbed العام (بدون مفتاح):
//   GET https://www.tiktok.com/oembed?url=<رابط الفيديو الكامل>
// يعطي: الوصف (title) واسم الحساب ورابطه والصورة المصغرة. لا يعطي المدة ولا الإحصاءات.
//
// ⚠️ شكل الرد وأكواد الأخطاء مبنية على معرفتي بالـ API وقت الكتابة ولم تُجرَّب على الشبكة هنا.
//    تحقق منها يدوياً (scripts/tryProvider.js) وراجع توثيق oEmbed الحالي (مهمة A1.4).
//
// العقد: fetchPost({ canonicalUrl, externalId }) -> Partial<postMeta> (لا ترمي أخطاء متوقعة)
const axios = require('axios');
const { POST_FETCH_STATUS } = require('../../../constants/submission.constants');

const OEMBED_URL = 'https://www.tiktok.com/oembed';
const REQUEST_TIMEOUT_MS = 6000;

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** @handle من رابط الحساب (https://www.tiktok.com/@name) */
const handleFromAuthorUrl = (authorUrl) => {
  const match = /tiktok\.com\/(@[^/?#]+)/i.exec(authorUrl || '');
  return match ? safeDecode(match[1]) : '';
};

const fetchPost = async ({ canonicalUrl }) => {
  let response;
  try {
    response = await axios.get(OEMBED_URL, {
      params: { url: canonicalUrl },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true, // نتعامل مع الحالات بأنفسنا
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; PayPerViewBot/1.0)' },
    });
  } catch (error) {
    console.error(`[tiktok.provider] request failed: ${error.message}`);
    return { fetchStatus: POST_FETCH_STATUS.UNAVAILABLE };
  }

  const { status, data } = response;

  // الفيديو محذوف أو رابطه غير صالح (oEmbed لا يفرّق بين المحذوف والخاص)
  if (status === 400 || status === 404) {
    return { fetchStatus: POST_FETCH_STATUS.NOT_FOUND };
  }

  // حظر/ضغط/عطل عندهم: لا نحكم على المنشور
  if (status !== 200 || !data || typeof data !== 'object') {
    console.error(`[tiktok.provider] unexpected response: HTTP ${status}`);
    return { fetchStatus: POST_FETCH_STATUS.UNAVAILABLE };
  }

  // رد 200 بمحتوى خطأ ({ code, message }) بدل بيانات الفيديو
  const looksLikeVideo = data.author_name || data.author_url || data.author_unique_id || data.html;
  if (!looksLikeVideo) {
    return { fetchStatus: POST_FETCH_STATUS.NOT_FOUND };
  }

  const handle = data.author_unique_id ? `@${data.author_unique_id}` : handleFromAuthorUrl(data.author_url);

  return {
    fetchStatus: POST_FETCH_STATUS.OK,
    caption: typeof data.title === 'string' ? data.title : '',
    authorName: data.author_name || '',
    authorHandle: handle,
    authorUrl: data.author_url || '',
    thumbnailUrl: data.thumbnail_url || '',
    durationSec: null, // غير متاح عبر oEmbed
    stats: null,       // غير متاح عبر oEmbed
  };
};

module.exports = { fetchPost, handleFromAuthorUrl };