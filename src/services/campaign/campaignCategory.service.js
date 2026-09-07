// src/services/campaign/campaignCategory.service.js
const { CAMPAIGN_CATEGORIES } = require('../../constants/campaign.constants');

/**
 * getAllCategories
 * يرجع كل الفئات المتاحة مع أوصافها وأيقوناتها
 * البيانات ثابتة من الـ constants — لا استعلام لقاعدة البيانات
 *
 * @returns {Array} قائمة الفئات
 */
const getAllCategories = () => {
  return CAMPAIGN_CATEGORIES;
};

/**
 * getSubCategories
 * يرجع الفئات الفرعية المتاحة للاختيار عند تحديد MIXED
 * مستخرجة من CAMPAIGN_CATEGORIES مباشرة
 *
 * @returns {Array<string>} قائمة أسماء الفئات الفرعية
 */
const getSubCategories = () => {
  const mixedCategory = CAMPAIGN_CATEGORIES.find(
    (cat) => cat.name === 'MIXED'
  );

  // إذا لم يُعثر على MIXED لأي سبب → نرجع مصفوفة فارغة
  if (!mixedCategory) return [];

  return mixedCategory.subCategories;
};

module.exports = {
  getAllCategories,
  getSubCategories,
};