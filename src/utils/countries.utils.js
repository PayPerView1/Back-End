// src/utils/countries.utils.js
// المشروع يستخدم رمزين للدول:
//   - user.country            → ISO alpha-2  (مثل SA)   [profileValidator]
//   - campaign.targetCountries → ISO alpha-3  (مثل SAU)
// هذا الملف يوحّد التعامل: كل ما يخص الحملات والتفضيلات والفلاتر = alpha-3.
const countries = require('i18n-iso-countries');

// getAlpha3Codes() يرجع كائن مفاتيحه alpha-3 وقيمه alpha-2
const VALID_ALPHA3 = new Set(Object.keys(countries.getAlpha3Codes()));

/** هل القيمة رمز alpha-3 صالح؟ */
const isValidAlpha3 = (code) =>
  typeof code === 'string' && VALID_ALPHA3.has(code.trim().toUpperCase());

/**
 * يحوّل رمز دولة (alpha-2 أو alpha-3) إلى alpha-3.
 * يرجع null إذا كان الرمز غير صالح أو فارغاً.
 */
const normalizeToAlpha3 = (code) => {
  if (!code || typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();

  if (c.length === 3) return VALID_ALPHA3.has(c) ? c : null;
  if (c.length === 2) return countries.alpha2ToAlpha3(c) || null;
  return null;
};

/** دولة المستخدم (من البروفايل) بصيغة alpha-3، أو null إن لم تكن مضبوطة */
const userCountryToAlpha3 = (user) => normalizeToAlpha3(user && user.country);

/**
 * يطبّع مصفوفة رموز دول إلى alpha-3 فريدة وصالحة فقط.
 * يرجع { valid: [...], invalid: [...] } ليستخدمه الـ validator.
 */
const normalizeCountryList = (list) => {
  const valid = [];
  const invalid = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const n = normalizeToAlpha3(item);
    if (n) {
      if (!valid.includes(n)) valid.push(n);
    } else {
      invalid.push(item);
    }
  });
  return { valid, invalid };
};

module.exports = {
  isValidAlpha3,
  normalizeToAlpha3,
  userCountryToAlpha3,
  normalizeCountryList,
};