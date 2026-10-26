// src/utils/submission/hashtag.utils.js
// وحدات نقية (بدون قاعدة بيانات) لمقارنة الهاشتاقات والمنشن والكلمات المفتاحية،
// مع دعم العربية: تجاهل التشكيل والتطويل، وتوحيد الألف والياء، و"_" = مسافة.
//
// التوقيعات المتفق عليها:
//   normalizeText(value)           -> string  (للبحث النصي)
//   normalizeTag(value)            -> string  (مفتاح مقارنة هاشتاق)
//   extractHashtags(text)          -> string[] مثل ['#تمويل_إسلامي'] (فريدة)
//   extractMentions(text)          -> string[] مثل ['@WafiFinance'] (فريدة)
//   hasTag(list, tag)              -> boolean
//   hasMention(list, mention)      -> boolean
//   toDisplayTag / toDisplayMention-> string  (بالبادئة # أو @)
//   toStoredList(values, options)  -> string[] (بدون بادئة، فريدة، منظّفة)

// تشكيل + علامات قرآنية + تطويل
const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const normalizeText = (value) =>
  String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ی/g, 'ي') // ياء فارسية
    .replace(/ک/g, 'ك') // كاف فارسية
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTag = (value) =>
  normalizeText(value)
    .replace(/^[#@]+/, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const mentionKey = (value) => normalizeText(value).replace(/^@+/, '');

const HASHTAG_REGEX = /#([\p{L}\p{M}\p{N}_]+)/gu;
// lookbehind يمنع التقاط البريد الإلكتروني (a@b.com)
const MENTION_REGEX = /(?<![\p{L}\p{N}_.@])@([\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)*)/gu;

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractHashtags = (text) => {
  const found = [];
  for (const match of String(text || '').matchAll(HASHTAG_REGEX)) {
    found.push(`#${match[1]}`);
  }
  return uniqueBy(found, normalizeTag);
};

const extractMentions = (text) => {
  const found = [];
  for (const match of String(text || '').matchAll(MENTION_REGEX)) {
    found.push(`@${match[1]}`);
  }
  return uniqueBy(found, mentionKey);
};

const hasTag = (list, tag) => {
  const key = normalizeTag(tag);
  if (!key) return false;
  return (list || []).some((t) => normalizeTag(t) === key);
};

const hasMention = (list, mention) => {
  const key = mentionKey(mention);
  if (!key) return false;
  return (list || []).some((m) => mentionKey(m) === key);
};

const stripPrefix = (value) => String(value || '').trim().replace(/^[#@]+/, '');

const toDisplayTag = (value) => `#${stripPrefix(value)}`;
const toDisplayMention = (value) => `@${stripPrefix(value)}`;

/**
 * ينظّف قائمة قيم قبل تخزينها (هاشتاقات/منشن/كلمات): يحذف البادئة، الفراغات،
 * المكرر، ويقصّ كل عنصر. يحافظ على الشكل الأصلي (لا يطبّع الحروف).
 */
const toStoredList = (values, { max = 30, maxLength = 100 } = {}) => {
  const cleaned = (Array.isArray(values) ? values : [])
    .map((v) => stripPrefix(v).slice(0, maxLength))
    .filter(Boolean);
  return uniqueBy(cleaned, normalizeTag).slice(0, max);
};

module.exports = {
  normalizeText,
  normalizeTag,
  mentionKey,
  extractHashtags,
  extractMentions,
  hasTag,
  hasMention,
  toDisplayTag,
  toDisplayMention,
  toStoredList,
};