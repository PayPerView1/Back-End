// src/utils/campaign/pagination.utils.js

/**
 * Pagination Utilities
 * الشخص الثاني — Management Pipeline
 *
 * يُستخدم في: campaignManagement.service.js
 */

/**
 * القيم الافتراضية
 */
const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 50,
};

/**
 * buildPaginationOptions
 * تحويل الـ query parameters إلى خيارات MongoDB
 *
 * @param {Object} query - req.query من الـ request
 * @param {number} query.page
 * @param {number} query.limit
 * @returns {{ skip: number, limit: number, page: number }}
 *
 * @example
 * const { skip, limit, page } = buildPaginationOptions(req.query);
 * Campaign.find(filter).skip(skip).limit(limit);
 */
const buildPaginationOptions = (query = {}) => {
  // تحويل القيم إلى أرقام والتحقق من صحتها
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  // إذا كانت القيم غير صحيحة أو سالبة → نرجع للافتراضية
  if (!page || page < 1) page = PAGINATION_DEFAULTS.PAGE;
  if (!limit || limit < 1) limit = PAGINATION_DEFAULTS.LIMIT;

  // لا نسمح بتجاوز الحد الأقصى
  if (limit > PAGINATION_DEFAULTS.MAX_LIMIT) limit = PAGINATION_DEFAULTS.MAX_LIMIT;

  const skip = (page - 1) * limit;

  return { skip, limit, page };
};

/**
 * buildPaginationResponse
 * بناء الـ pagination object الذي يُرجع في الـ response
 *
 * @param {number} totalDocuments - إجمالي عدد الـ documents المطابقة للـ filter
 * @param {number} page - الصفحة الحالية
 * @param {number} limit - عدد العناصر في الصفحة
 * @returns {Object} pagination response object
 *
 * @example
 * const pagination = buildPaginationResponse(98, 1, 20);
 * // {
 * //   currentPage: 1,
 * //   totalPages: 5,
 * //   totalCampaigns: 98,
 * //   limit: 20,
 * //   hasNextPage: true,
 * //   hasPrevPage: false
 * // }
 */
const buildPaginationResponse = (totalDocuments, page, limit) => {
  const totalPages = Math.ceil(totalDocuments / limit);

  return {
    currentPage: page,
    totalPages,
    totalCampaigns: totalDocuments,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * buildSortOptions
 * تحويل الـ sort parameters إلى MongoDB sort object
 *
 * @param {string} sortBy   - الحقل المراد الترتيب حسبه
 * @param {string} sortOrder - 'asc' أو 'desc'
 * @returns {Object} MongoDB sort object
 *
 * @example
 * buildSortOptions('totalBudget', 'desc') // → { totalBudget: -1 }
 * buildSortOptions('name', 'asc')         // → { name: 1 }
 * buildSortOptions('invalid', 'asc')      // → { createdAt: -1 } (fallback)
 */

// الحقول المسموح بالترتيب حسبها
const ALLOWED_SORT_FIELDS = ['createdAt', 'name', 'totalBudget'];

const buildSortOptions = (sortBy, sortOrder) => {
  // التحقق من صحة الحقل
  const field = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';

  // تحويل 'asc'/'desc' إلى 1/-1 (صيغة MongoDB)
  const order = sortOrder === 'asc' ? 1 : -1;

  return { [field]: order };
};

/**
 * buildDateFilter
 * بناء MongoDB date filter من dateFrom و dateTo
 *
 * @param {string} dateFrom - ISO date string (مثال: '2026-01-01')
 * @param {string} dateTo   - ISO date string (مثال: '2026-08-31')
 * @returns {Object|null} MongoDB date filter أو null إذا لم يُرسَل تاريخ
 *
 * @example
 * buildDateFilter('2026-01-01', '2026-08-31')
 * // → { $gte: Date('2026-01-01'), $lte: Date('2026-08-31T23:59:59') }
 */
const buildDateFilter = (dateFrom, dateTo) => {
  // إذا لم يُرسَل أي تاريخ → لا يوجد filter
  if (!dateFrom && !dateTo) return null;

  const dateFilter = {};

  if (dateFrom) {
    const from = new Date(dateFrom);
    // التحقق من صحة التاريخ
    if (!isNaN(from.getTime())) {
      from.setHours(0, 0, 0, 0); // بداية اليوم
      dateFilter.$gte = from;
    }
  }

  if (dateTo) {
    const to = new Date(dateTo);
    if (!isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999); // نهاية اليوم
      dateFilter.$lte = to;
    }
  }

  // إذا لم ينجح بناء أي filter → نرجع null
  if (Object.keys(dateFilter).length === 0) return null;

  return dateFilter;
};

module.exports = {
  PAGINATION_DEFAULTS,
  ALLOWED_SORT_FIELDS,
  buildPaginationOptions,
  buildPaginationResponse,
  buildSortOptions,
  buildDateFilter,
};