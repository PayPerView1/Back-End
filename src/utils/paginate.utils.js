// src/utils/paginate.utils.js
// ترقيم الصفحات لـ endpoints سبرنت 4 بنفس شكل عقد سبرنت 3:
//   "pagination": { "page", "perPage", "total", "totalPages" }
// (لا يستبدل campaign/pagination.utils.js الخاص بسبرنت 2، فذاك يرجع
//  currentPage/totalCampaigns وفرونت سبرنت 2 يعتمد عليه.)

/**
 * يقرأ page و perPage من الـ query (ويقبل limit كاسم بديل).
 * @param {Object} query
 * @param {{ defaultPerPage?: number, maxPerPage?: number }} [options]
 * @returns {{ page: number, perPage: number, skip: number, limit: number }}
 */
const parsePagination = (query = {}, options = {}) => {
  const { defaultPerPage = 20, maxPerPage = 50 } = options;

  let page = parseInt(query.page, 10);
  let perPage = parseInt(query.perPage !== undefined ? query.perPage : query.limit, 10);

  if (!page || page < 1) page = 1;
  if (!perPage || perPage < 1) perPage = defaultPerPage;
  if (perPage > maxPerPage) perPage = maxPerPage;

  return { page, perPage, skip: (page - 1) * perPage, limit: perPage };
};

/**
 * يبني كائن pagination للاستجابة.
 * @param {number} total   إجمالي العناصر المطابقة
 * @param {number} page
 * @param {number} perPage
 */
const buildPageMeta = (total, page, perPage) => ({
  page,
  perPage,
  total,
  totalPages: Math.ceil(total / perPage),
});

module.exports = { parsePagination, buildPageMeta };