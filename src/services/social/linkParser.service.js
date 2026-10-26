// src/services/social/linkParser.service.js
// تحليل رابط المنشور: كشف المنصة، التطبيع، واستخراج معرّف الفيديو.
//
// التوقيعات المتفق عليها:
//   parseLink(rawUrl, selectedPlatform)        -> { platform, canonicalUrl, externalId, needsResolve }   (متزامنة)
//   resolveShortLink(parsed)                   -> parsed بعد حل الرابط المختصر (async)
//   resolveAndParse(rawUrl, selectedPlatform)  -> المدخل الذي تستعمله الخدمات (async)
//
// تُرمى AppError بالأكواد: INVALID_LINK / UNSUPPORTED_PLATFORM / PLATFORM_MISMATCH
// ⚠️ SSRF: الشبكة تُستعمل فقط لحل الروابط المختصرة، ومع قائمة مضيفين مسموحة.
const { AppError } = require('../../utils/errors');
const { PLATFORM, SUBMISSION_CONFIG } = require('../../constants/submission.constants');

const TIKTOK_SHORT_HOSTS = ['vm.tiktok.com', 'vt.tiktok.com'];
// المضيفون المسموح التنقل بينهم أثناء حل الرابط المختصر
const RESOLVE_ALLOWED_HOSTS = ['vm.tiktok.com', 'vt.tiktok.com', 'tiktok.com', 'www.tiktok.com', 'm.tiktok.com'];
const RESOLVE_MAX_HOPS = 3;
const RESOLVE_TIMEOUT_MS = 5000;

const invalid = (hint, extra = {}) =>
  new AppError('Invalid link', 'INVALID_LINK', undefined, { hint: hint || null, ...extra });

const safeDecode = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const normalizeHost = (hostname) => hostname.toLowerCase().replace(/^(www|m)\./, '');

const detectPlatformByHost = (host) => {
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return PLATFORM.TIKTOK;
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return PLATFORM.INSTAGRAM;
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return PLATFORM.YOUTUBE;
  return null;
};

const parseUrlOrThrow = (rawUrl) => {
  if (typeof rawUrl !== 'string') throw invalid();
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > SUBMISSION_CONFIG.URL_MAX_LENGTH) throw invalid();

  // نسمح بلصق رابط بدون https://
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw invalid();
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw invalid();
  if (url.username || url.password) throw invalid();
  if (url.port && !['80', '443'].includes(url.port)) throw invalid();
  return url;
};

// ----------------------
// مفسّرات المنصات
// ----------------------
const parseTikTok = (host, segs) => {
  // روابط مختصرة: vm./vt.tiktok.com/<code>  و tiktok.com/t/<code>
  if (TIKTOK_SHORT_HOSTS.includes(host) && /^[A-Za-z0-9_-]{4,30}$/.test(segs[0] || '')) {
    return {
      platform: PLATFORM.TIKTOK,
      canonicalUrl: `https://${host}/${segs[0]}/`,
      externalId: null,
      needsResolve: true,
    };
  }
  if (segs[0] === 't' && /^[A-Za-z0-9_-]{4,30}$/.test(segs[1] || '')) {
    return {
      platform: PLATFORM.TIKTOK,
      canonicalUrl: `https://www.tiktok.com/t/${segs[1]}/`,
      externalId: null,
      needsResolve: true,
    };
  }
  // الرابط الكامل: tiktok.com/@user/video/<id>
  if (segs[0] && segs[0].startsWith('@') && segs[1] === 'video' && /^\d{6,25}$/.test(segs[2] || '')) {
    return {
      platform: PLATFORM.TIKTOK,
      canonicalUrl: `https://www.tiktok.com/${segs[0]}/video/${segs[2]}`,
      externalId: segs[2],
      needsResolve: false,
    };
  }
  throw invalid('VIDEO_URL_REQUIRED');
};

const parseInstagram = (segs) => {
  // /reel/<code> أو /reels/<code> أو /<user>/reel/<code>
  const idx = segs.findIndex((s) => s === 'reel' || s === 'reels');
  const code = idx !== -1 ? segs[idx + 1] : null;
  if (code && code !== 'audio' && /^[A-Za-z0-9_-]{5,20}$/.test(code)) {
    return {
      platform: PLATFORM.INSTAGRAM,
      canonicalUrl: `https://www.instagram.com/reel/${code}/`,
      externalId: code, // حساس لحالة الأحرف
      needsResolve: false,
    };
  }
  throw invalid('REEL_URL_REQUIRED');
};

const parseYouTube = (host, segs) => {
  // Shorts فقط في الـ MVP
  if (host !== 'youtu.be' && segs[0] === 'shorts' && /^[A-Za-z0-9_-]{11}$/.test(segs[1] || '')) {
    return {
      platform: PLATFORM.YOUTUBE,
      canonicalUrl: `https://www.youtube.com/shorts/${segs[1]}`,
      externalId: segs[1],
      needsResolve: false,
    };
  }
  throw invalid('SHORTS_URL_REQUIRED');
};

// ----------------------
// المدخل المتزامن
// ----------------------
/**
 * @param {string} rawUrl
 * @param {string} [selectedPlatform] المنصة التي اختارها المبدع (للتحقق من التطابق)
 */
const parseLink = (rawUrl, selectedPlatform) => {
  const url = parseUrlOrThrow(rawUrl);
  const host = normalizeHost(url.hostname);
  const detected = detectPlatformByHost(host);

  if (!detected) {
    throw new AppError('Unsupported platform', 'UNSUPPORTED_PLATFORM');
  }
  if (selectedPlatform && detected !== selectedPlatform) {
    throw new AppError('Link does not match the selected platform', 'PLATFORM_MISMATCH', undefined, { detected });
  }

  const segs = url.pathname.split('/').filter(Boolean).map(safeDecode);

  switch (detected) {
    case PLATFORM.TIKTOK:
      return parseTikTok(host, segs);
    case PLATFORM.INSTAGRAM:
      return parseInstagram(segs);
    default:
      return parseYouTube(host, segs);
  }
};

// ----------------------
// حل الروابط المختصرة (شبكة)
// ----------------------
const resolveShortLink = async (parsed) => {
  const axios = require('axios'); // تحميل متأخر ليبقى parseLink نقياً في الاختبارات
  let current = parsed.canonicalUrl;

  for (let hop = 0; hop < RESOLVE_MAX_HOPS; hop += 1) {
    let host;
    try {
      host = new URL(current).hostname.toLowerCase();
    } catch {
      throw invalid();
    }
    if (!RESOLVE_ALLOWED_HOSTS.includes(host)) throw invalid();

    let response;
    try {
      response = await axios.get(current, {
        maxRedirects: 0,
        timeout: RESOLVE_TIMEOUT_MS,
        validateStatus: () => true,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PayPerViewBot/1.0)' },
      });
    } catch {
      throw invalid(null, { httpStatus: null });
    }

    const { status, headers } = response;
    if (response.data && typeof response.data.destroy === 'function') response.data.destroy();

    if (status >= 300 && status < 400 && headers.location) {
      const next = new URL(headers.location, current).toString();
      try {
        const result = parseLink(next, PLATFORM.TIKTOK);
        if (!result.needsResolve) return result;
      } catch {
        // ليس رابط فيديو بعد: نكمل التنقل
      }
      current = next;
      continue;
    }

    throw invalid(null, { httpStatus: status });
  }

  throw invalid();
};

/** المدخل الذي تستعمله خدمات التسليم: parse ثم حل الروابط المختصرة إن لزم */
const resolveAndParse = async (rawUrl, selectedPlatform) => {
  const parsed = parseLink(rawUrl, selectedPlatform);
  return parsed.needsResolve ? resolveShortLink(parsed) : parsed;
};

module.exports = { parseLink, resolveShortLink, resolveAndParse, detectPlatformByHost };