// src/utils/campaign/matchScore.utils.js
// المالك: الشخص B — دالة تقييم التطابق (Best Match / Recommendations).
// المرجع: API_CONTRACT_Sprint4.md §2.1
//
// ⚠️ هذه الدالة نقية (pure) — لا استعلامات قاعدة بيانات.
//    الاستدعاء (populate + query) مسؤولية الـ service.

/**
 * يحسب درجة التطابق بين حملة وتفضيلات مبدع + تاريخه.
 *
 * @param {Object} campaign - حملة (lean document)
 * @param {Object} context
 * @param {Object|null} context.preferences - تفضيلات المبدع (أو null)
 * @param {string[]}    context.previousContentTypes - أنواع محتوى تقديمات سابقة
 *
 * @returns {{ score: number, reasons: Array<{ code: string, value: string|number }> }}
 */
const computeMatchScore = (campaign, context = {}) => {
  const reasons = [];
  let score = 0;

  if (!campaign) return { score: 0, reasons: [] };

  const { preferences, previousContentTypes = [] } = context;

  const campaignCountries = Array.isArray(campaign.targetCountries)
    ? campaign.targetCountries
    : [];
  const campaignContentType = campaign.contentType;
  const campaignSubCategories = Array.isArray(campaign.subCategories)
    ? campaign.subCategories
    : [];
  const campaignCpm = typeof campaign.cpm === 'number' ? campaign.cpm : 0;

  // ─────────────────────────────────────────────
  // 1. تطابق الدولة
  // ─────────────────────────────────────────────
  if (
    preferences &&
    Array.isArray(preferences.preferredCountries) &&
    preferences.preferredCountries.length > 0
  ) {
    const matchedCountry = preferences.preferredCountries.find((c) =>
      campaignCountries.includes(c)
    );
    if (matchedCountry) {
      score += 3;
      reasons.push({ code: 'COUNTRY_MATCH', value: matchedCountry });
    }
  }

  // ─────────────────────────────────────────────
  // 2. تطابق نوع المحتوى (تفضيلات)
  // ─────────────────────────────────────────────
  let contentTypeMatched = false;

  if (
    preferences &&
    Array.isArray(preferences.preferredContentTypes) &&
    preferences.preferredContentTypes.length > 0
  ) {
    const match =
      preferences.preferredContentTypes.includes(campaignContentType) ||
      campaignSubCategories.some((sc) =>
        preferences.preferredContentTypes.includes(sc)
      );

    if (match) {
      score += 2;
      reasons.push({
        code: 'CONTENT_TYPE_MATCH',
        value: campaignContentType,
      });
      contentTypeMatched = true;
    }
  }

  // ─────────────────────────────────────────────
  // 3. CPM ≥ minCpm
  // ─────────────────────────────────────────────
  if (preferences && typeof preferences.minCpm === 'number' && preferences.minCpm > 0) {
    if (campaignCpm >= preferences.minCpm) {
      score += 1;
      reasons.push({ code: 'CPM_MATCH', value: campaignCpm });
    }
  }

  // ─────────────────────────────────────────────
  // 4. مشاركة سابقة بنفس نوع المحتوى
  // ─────────────────────────────────────────────
  if (!contentTypeMatched && Array.isArray(previousContentTypes) && previousContentTypes.length > 0) {
    const participated =
      previousContentTypes.includes(campaignContentType) ||
      campaignSubCategories.some((sc) => previousContentTypes.includes(sc));

    if (participated) {
      score += 2;
      reasons.push({
        code: 'PREVIOUS_PARTICIPATION',
        value: campaignContentType,
      });
    }
  }

  return { score, reasons };
};

module.exports = { computeMatchScore };