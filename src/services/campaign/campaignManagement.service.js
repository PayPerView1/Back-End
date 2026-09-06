// src/services/campaign/campaignManagement.service.js
const Campaign = require('../../models/campaign');
const CampaignDraft = require('../../models/CampaignDraft');
const CampaignActivityLog = require('../../models/CampaignActivityLog');
const { deleteFilesFromStorage } = require('./fileUpload.service');
const {
  CAMPAIGN_STATUS,
  CAMPAIGN_ACTION,
} = require('../../constants/campaign.constants');
const {
  buildPaginationOptions,
  buildPaginationResponse,
  buildSortOptions,
  buildDateFilter,
} = require('../../utils/campaign/pagination.utils');

// ─────────────────────────────────────────────────────────────
// ملاحظة: activityLog.service.js و campaignStatus.utils.js
// سيُنجزهما الشخص الأول — نستوردهما هنا والـ require لن يكسر
// الـ server لأننا نستدعيهما داخل الدوال وليس عند التحميل.
// عندما يُنجز الشخص الأول ملفاته ستعمل تلقائياً.
// ─────────────────────────────────────────────────────────────
const { logActivity } = require('./activityLog.service');
const {
  isTransitionAllowed,
  isDeletable,
  isArchivable,
} = require('../../utils/campaign/campaignStatus.utils');

// ═══════════════════════════════════════════════════════════════
// 1. getCampaigns
// جلب قائمة حملات المعلن مع الفلترة والبحث والترتيب والـ pagination
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} advertiserId   - ID المعلن المسجل دخوله
 * @param {Object} filters        - الفلاتر القادمة من req.query بعد الـ validation
 * @param {string} [filters.status]
 * @param {string} [filters.category]
 * @param {Date}   [filters.dateFrom]
 * @param {Date}   [filters.dateTo]
 * @param {string} [filters.search]
 * @param {string} [filters.sortBy]
 * @param {string} [filters.sortOrder]
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 * @param {boolean}[filters.isArchived]
 *
 * @returns {{ campaigns, pagination, summary }}
 */
const getCampaigns = async (advertiserId, filters = {}) => {
  // ── بناء الـ query ──────────────────────────────────────────
  const query = buildCampaignQuery(advertiserId, filters);

  // ── خيارات الـ pagination والترتيب ─────────────────────────
  const { skip, limit, page } = buildPaginationOptions(filters);
  const sort = buildSortOptions(filters.sortBy, filters.sortOrder);

  // ── تنفيذ الاستعلامين بالتوازي لتوفير الوقت ────────────────
  const [campaigns, totalDocuments] = await Promise.all([
    Campaign.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      // نُرجع فقط الحقول التي تحتاجها بطاقة الحملة في القائمة
      .select(
        'name status category contentType totalBudget remainingBudget ' +
        'cpm targetCountries stats aiReview isArchived copyInfo ' +
        'createdAt submittedAt activatedAt completedAt'
      )
      .lean(), // lean() أسرع لأننا لن نُعدّل الـ documents
    Campaign.countDocuments(query),
  ]);

  // ── بناء الـ summary (إحصائيات مختصرة للـ dashboard) ───────
  const summary = await getCampaignsSummary(advertiserId, filters.isArchived);

  return {
    campaigns,
    pagination: buildPaginationResponse(totalDocuments, page, limit),
    summary,
  };
};

/**
 * buildCampaignQuery — دالة مساعدة داخلية
 * تجمع كل الـ filters في MongoDB query object واحد
 */
const buildCampaignQuery = (advertiserId, filters) => {
  const query = { advertiserId };

  // ── فلتر الأرشفة ───────────────────────────────────────────
  // isArchived له قيمة افتراضية false — نُرجع الغير مؤرشفة إذا لم يُحدد
  query.isArchived = filters.isArchived === true;

  // ── فلتر الحالة ─────────────────────────────────────────────
  if (filters.status && filters.status !== 'ALL') {
    query.status = filters.status;
  }

  // ── فلتر الفئة ──────────────────────────────────────────────
  if (filters.category) {
    query.category = filters.category;
  }

  // ── فلتر التاريخ ─────────────────────────────────────────────
  const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);
  if (dateFilter) {
    query.createdAt = dateFilter;
  }

  // ── فلتر البحث النصي ─────────────────────────────────────────
  // نستخدم الـ text index الموجود في الـ Campaign model على حقل name
  if (filters.search && filters.search.trim()) {
    query.$text = { $search: filters.search.trim() };
  }

  return query;
};

/**
 * getCampaignsSummary — دالة مساعدة داخلية
 * تحسب عدد الحملات لكل حالة للمعلن
 */
const getCampaignsSummary = async (advertiserId, isArchived = false) => {
  const result = await Campaign.aggregate([
    {
      $match: {
        advertiserId: advertiserId,
        isArchived: isArchived === true
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = {
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    draft: 0,
    rejected: 0,
    archived: 0,
    cancelled: 0,
    manualReview: 0,
    expired: 0,
  };

  result.forEach(({ _id, count }) => {
    summary.total += count;
    switch (_id) {
      case CAMPAIGN_STATUS.ACTIVE:         summary.active       += count; break;
      case CAMPAIGN_STATUS.PENDING_REVIEW: summary.pending      += count; break;
      case CAMPAIGN_STATUS.COMPLETED:      summary.completed    += count; break;
      case CAMPAIGN_STATUS.DRAFT:          summary.draft        += count; break;
      case CAMPAIGN_STATUS.REJECTED:       summary.rejected     += count; break;
      case CAMPAIGN_STATUS.ARCHIVED:       summary.archived     += count; break;
      case CAMPAIGN_STATUS.CANCELLED:      summary.cancelled    += count; break;
      case CAMPAIGN_STATUS.MANUAL_REVIEW:  summary.manualReview += count; break;
      case CAMPAIGN_STATUS.EXPIRED:        summary.expired      += count; break;
    }
  });

  return summary;
};

// ═══════════════════════════════════════════════════════════════
// 2. getCampaignById
// جلب تفاصيل حملة واحدة كاملة مع سجل النشاطات
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} campaignId   - ID الحملة
 * @param {string} advertiserId - ID المعلن (للتحقق من الـ ownership)
 * @returns {{ campaign, statusHistory }}
 * @throws {Error} 404 إذا لم تُوجد الحملة أو لا يملكها المعلن
 */
const getCampaignById = async (campaign) => {
  // Convert Mongoose document to plain object if necessary
  const campaignData = campaign.toObject ? campaign.toObject() : campaign;

  // Fetch only the activity log timeline (single DB query instead of two)
  const statusHistory = await CampaignActivityLog.find({ campaignId: campaign._id })
    .sort({ createdAt: 1 })
    .select('action performedBy createdAt metadata')
    .lean();

  return { campaign: campaignData, statusHistory };
};

// ═══════════════════════════════════════════════════════════════
// 3. copyCampaign
// نسخ حملة موجودة وإنشاء مسودة جديدة منها
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} campaignId   - ID الحملة المراد نسخها
 * @param {string} advertiserId - ID المعلن
 * @param {Object} options
 * @param {string}  [options.newName]         - اسم الحملة الجديدة (اختياري)
 * @param {boolean} [options.includeMaterials] - هل تُنسخ المواد؟ (default: true)
 * @returns {Object} الـ draft الجديد
 * @throws {Error} 404 إذا لم تُوجد الحملة
 */
const copyCampaign = async (campaignId, advertiserId, options = {}) => {
  const { newName, includeMaterials = true } = options;

  // ── جلب الحملة الأصلية ──────────────────────────────────────
  const original = await Campaign.findOne({ _id: campaignId, advertiserId });

  if (!original) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  // ── بناء بيانات المسودة الجديدة ─────────────────────────────

  const draftData = {
    advertiserId,
    name: newName || `${original.name} (Copy)`,
    contentType:    original.contentType,
    category:       original.category,
    subCategories:  original.subCategories,
    totalBudget:    original.totalBudget,
    cpm:            original.cpm,
    dailyBudgetLimit: original.dailyBudgetLimit,
    brief:          original.brief,
    targetCountries: original.targetCountries,
    copyInfo: { isCopy: true, copiedFromId: original._id },
    // إعلان الحلال — نرجع للـ false لأن المعلن يجب أن يُعلن من جديد
    halalDeclared:  false,
    // المواد — تُنسخ فقط إذا طُلب ذلك
    materials: includeMaterials
      ? original.materials.map((m) => ({
          fileName:   m.fileName,
          fileUrl:    m.fileUrl,
          fileType:   m.fileType,
          fileSizeKb: m.fileSizeKb,
          mimeType:   m.mimeType,
          uploadedBy: advertiserId,
        }))
      : [],
  };

  const draft = await CampaignDraft.create(draftData);

  // ── زيادة copyCount في الحملة الأصلية ───────────────────────
  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: { copyCount: 1 },
  });

  // ── تسجيل النشاط ────────────────────────────────────────────
  await logActivity(campaignId, CAMPAIGN_ACTION.COPIED, advertiserId, {
    newDraftId: draft._id,
    newName: draft.name,
    includeMaterials,
  });

  return draft;
};

// ═══════════════════════════════════════════════════════════════
// 4. archiveCampaign
// أرشفة حملة — مسموح فقط لحالات محددة
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} campaignId   - ID الحملة
 * @param {string} advertiserId - ID المعلن
 * @returns {Object} الحملة بعد التحديث
 * @throws {Error} 400 إذا كانت الحالة لا تسمح بالأرشفة
 * @throws {Error} 404 إذا لم تُوجد الحملة
 */
const archiveCampaign = async (campaignId, advertiserId) => {
  const campaign = await Campaign.findOne({ _id: campaignId, advertiserId });

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  // ── التحقق من إمكانية الأرشفة ───────────────────────────────
  if (!isArchivable(campaign.status)) {
    const error = new Error(
      `Cannot archive a campaign with status "${campaign.status}". ` +
      'Only COMPLETED, REJECTED, CANCELLED, or EXPIRED campaigns can be archived'
    );
    error.statusCode = 400;
    throw error;
  }

  // ── التحديث ─────────────────────────────────────────────────
   const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
      },
    },
    { 
      returnDocument: 'after',
      runValidators: true, // ⚠️ هذا يتجاوز pre('validate') hook
    }
  );
  // campaign.isArchived = true;
  // campaign.archivedAt = new Date();
  // await campaign.save();

  // ── تسجيل النشاط ────────────────────────────────────────────
  await logActivity(campaignId, CAMPAIGN_ACTION.ARCHIVED, advertiserId);

  return {
    campaignId: updatedCampaign._id,
    isArchived: updatedCampaign.isArchived,
    archivedAt: updatedCampaign.archivedAt,
  };
};

// ═══════════════════════════════════════════════════════════════
// 5. restoreCampaign
// استعادة حملة مؤرشفة
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} campaignId   - ID الحملة
 * @param {string} advertiserId - ID المعلن
 * @returns {Object} الحملة بعد الاستعادة
 * @throws {Error} 400 إذا لم تكن الحملة مؤرشفة
 * @throws {Error} 404 إذا لم تُوجد الحملة
 */
const restoreCampaign = async (campaignId, advertiserId) => {
  const campaign = await Campaign.findOne({ _id: campaignId, advertiserId });

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  // ── التحقق من أنها مؤرشفة فعلاً ────────────────────────────
  if (!campaign.isArchived) {
    const error = new Error('Campaign is not archived');
    error.statusCode = 400;
    throw error;
  }

  // ── التحديث ─────────────────────────────────────────────────
  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        isArchived: false,
        archivedAt: null,
      },
    },
    {
      returnDocument: 'after',  // ✅ بدلاً من new: true
      runValidators: true,
    }
  );

  // ── تسجيل النشاط ────────────────────────────────────────────
  await logActivity(campaignId, CAMPAIGN_ACTION.RESTORED, advertiserId);

  return {
    campaignId: updatedCampaign._id,
    isArchived: updatedCampaign.isArchived,
    status: updatedCampaign.status,
  };
};
// const restoreCampaign = async (campaignId, advertiserId) => {
//   const campaign = await Campaign.findOne({ _id: campaignId, advertiserId });

//   if (!campaign) {
//     const error = new Error('Campaign not found');
//     error.statusCode = 404;
//     throw error;
//   }

//   // ── التحقق من أنها مؤرشفة فعلاً ────────────────────────────
//   if (!campaign.isArchived) {
//     const error = new Error('Campaign is not archived');
//     error.statusCode = 400;
//     throw error;
//   }

//   // ── التحديث ─────────────────────────────────────────────────
//   campaign.isArchived = false;
//   campaign.archivedAt = null;
//   await campaign.save();

//   // ── تسجيل النشاط ────────────────────────────────────────────
//   await logActivity(campaignId, CAMPAIGN_ACTION.RESTORED, advertiserId);

//   return {
//     campaignId: campaign._id,
//     isArchived: campaign.isArchived,
//     status: campaign.status,
//   };
// };

// ═══════════════════════════════════════════════════════════════
// 6. deleteCampaign
// حذف حملة — مسموح فقط للحالات DRAFT و REJECTED
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} campaignId   - ID الحملة
 * @param {string} advertiserId - ID المعلن
 * @throws {Error} 400 إذا كانت الحالة لا تسمح بالحذف
 * @throws {Error} 404 إذا لم تُوجد الحملة
 */
const deleteCampaign = async (campaignId, advertiserId) => {
  const campaign = await Campaign.findOne({ _id: campaignId, advertiserId });

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  // ── التحقق من إمكانية الحذف ─────────────────────────────────
  if (!isDeletable(campaign.status)) {
    const error = new Error(
      `Cannot delete a campaign with status "${campaign.status}". ` +
      'Only DRAFT or REJECTED campaigns can be deleted'
    );
    error.statusCode = 400;
    throw error;
  }
  // Delete associated uploaded material files from storage
  if (campaign.materials && campaign.materials.length > 0) {
    const fileUrls = campaign.materials.map((m) => m.fileUrl);
    await deleteFilesFromStorage(fileUrls);
  }
  // ── حذف الـ activity logs المرتبطة أولاً ────────────────────
  await CampaignActivityLog.deleteMany({ campaignId });

  // ── حذف الحملة ──────────────────────────────────────────────
  await Campaign.findByIdAndDelete(campaignId);

  // ملاحظة: حذف الملفات من الـ storage مسؤولية fileUpload.service.js
  // الشخص الأول سيُضيف هذا في campaignCreation.service.js
};

// ═══════════════════════════════════════════════════════════════
// 7. bulkDeleteCampaigns
// حذف جماعي لعدة حملات
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string[]} campaignIds  - مصفوفة IDs الحملات
 * @param {string}  advertiserId  - ID المعلن
 * @returns {{ deleted: number, failed: number, failedIds: string[] }}
 */
const bulkDeleteCampaigns = async (campaignIds, advertiserId) => {
  const results = { deleted: 0, failed: 0, failedIds: [], errors: [] };

  for (const campaignId of campaignIds) {
    try {
      await deleteCampaign(campaignId, advertiserId);
      results.deleted++;
    } catch (err) {
      results.failed++;
      results.failedIds.push(campaignId);
      results.errors.push({
        campaignId,
        reason: err.message || 'Failed to delete campaign',
      });
    }
  }

  return results;
};

// ═══════════════════════════════════════════════════════════════
// 8. bulkArchiveCampaigns
// أرشفة جماعية لعدة حملات
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string[]} campaignIds  - مصفوفة IDs الحملات
 * @param {string}  advertiserId  - ID المعلن
 * @returns {{ archived: number, failed: number, failedIds: string[] }}
 */
const bulkArchiveCampaigns = async (campaignIds, advertiserId) => {
  const results = { archived: 0, failed: 0, failedIds: [], errors: [] };

  for (const campaignId of campaignIds) {
    try {
      await archiveCampaign(campaignId, advertiserId);
      results.archived++;
    } catch (err) {
      results.failed++;
      results.failedIds.push(campaignId);
      results.errors.push({
        campaignId,
        reason: err.message || 'Failed to archive campaign',
      });
    }
  }

  return results;
};

// ═══════════════════════════════════════════════════════════════
// 9. exportCampaignToCSV
// تصدير بيانات حملة كـ CSV string
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} campaignId   - ID الحملة
 * @param {string} advertiserId - ID المعلن
 * @returns {string} CSV content كـ string جاهزة للإرسال
 * @throws {Error} 404 إذا لم تُوجد الحملة
 */
const exportCampaignToCSV = async (campaignId, advertiserId) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    advertiserId,
  }).lean();

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  // ── تعريف الأعمدة ────────────────────────────────────────────
  const headers = [
    'Campaign ID',
    'Name',
    'Status',
    'Category',
    'Content Type',
    'Total Budget',
    'Remaining Budget',
    'CPM',
    'Total Views',
    'Total Spent',
    'Total Creators',
    'Total Approved Videos',
    'Target Countries',
    'AI Review Result',
    'AI Review Score',
    'Is Archived',
    'Created At',
    'Submitted At',
    'Activated At',
    'Completed At',
  ];

  // ── بناء صف البيانات ─────────────────────────────────────────
  const row = [
    campaign._id,
    `"${campaign.name}"`,          // نضع بين "" لأن الاسم قد يحتوي فاصلة
    campaign.status,
    campaign.category,
    campaign.contentType,
    campaign.totalBudget,
    campaign.remainingBudget,
    campaign.cpm,
    campaign.stats?.totalViews         ?? 0,
    campaign.stats?.totalSpent         ?? 0,
    campaign.stats?.totalCreators      ?? 0,
    campaign.stats?.totalApprovedVideos ?? 0,
    `"${(campaign.targetCountries || []).join(', ')}"`,
    campaign.aiReview?.result    ?? '',
    campaign.aiReview?.score     ?? '',
    campaign.isArchived,
    campaign.createdAt   ? new Date(campaign.createdAt).toISOString()   : '',
    campaign.submittedAt ? new Date(campaign.submittedAt).toISOString() : '',
    campaign.activatedAt ? new Date(campaign.activatedAt).toISOString() : '',
    campaign.completedAt ? new Date(campaign.completedAt).toISOString() : '',
  ];

  // ── تجميع الـ CSV ─────────────────────────────────────────────
  const csv = [headers.join(','), row.join(',')].join('\n');

  return csv;
};

// ═══════════════════════════════════════════════════════════════
// 10. getCampaignStatistics
// إحصائيات شاملة للوحة تحكم المعلن
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} advertiserId - ID المعلن
 * @returns {Object} إحصائيات الحملات
 */
const getCampaignStatistics = async (advertiserId) => {
  const stats = await Campaign.aggregate([
    // فلتر حملات المعلن فقط
    {
      $match: { advertiserId: advertiserId },
    },
    // تجميع الإحصائيات
    {
      $group: {
        _id: null,
        totalCampaigns:   { $sum: 1 },
        totalBudgetSpent: { $sum: '$stats.totalSpent' },
        totalCpmSum:      { $sum: '$cpm' },
        // count per status
        activeCampaigns:    { $sum: { $cond: [{ $eq: ['$status', CAMPAIGN_STATUS.ACTIVE] },         1, 0] } },
        completedCampaigns: { $sum: { $cond: [{ $eq: ['$status', CAMPAIGN_STATUS.COMPLETED] },      1, 0] } },
        draftCampaigns:     { $sum: { $cond: [{ $eq: ['$status', CAMPAIGN_STATUS.DRAFT] },          1, 0] } },
        rejectedCampaigns:  { $sum: { $cond: [{ $eq: ['$status', CAMPAIGN_STATUS.REJECTED] },       1, 0] } },
        pendingCampaigns:   { $sum: { $cond: [{ $eq: ['$status', CAMPAIGN_STATUS.PENDING_REVIEW] }, 1, 0] } },
        archivedCampaigns:  { $sum: { $cond: ['$isArchived',                                        1, 0] } },
      },
    },
    // إضافة حقل averageCpm
    {
      $addFields: {
        averageCpm: {
          $cond: [
            { $gt: ['$totalCampaigns', 0] },
            { $divide: ['$totalCpmSum', '$totalCampaigns'] },
            0,
          ],
        },
      },
    },
    // إزالة الحقول المؤقتة
    {
      $project: {
        _id:                0,
        totalCpmSum:        0,
      },
    },
  ]);

  // ── إحصائيات per category ────────────────────────────────────
  const byCategory = await Campaign.aggregate([
    { $match: { advertiserId: advertiserId } },
    {
      $group: {
        _id:   '$category',
        count: { $sum: 1 },
      },
    },
  ]);

  // تحويل مصفوفة byCategory إلى object
  const categoryBreakdown = {};
  byCategory.forEach(({ _id, count }) => {
    if (_id) categoryBreakdown[_id] = count;
  });

  // ── النتيجة النهائية ─────────────────────────────────────────
  const result = stats[0] || {
    totalCampaigns:     0,
    activeCampaigns:    0,
    completedCampaigns: 0,
    draftCampaigns:     0,
    rejectedCampaigns:  0,
    pendingCampaigns:   0,
    archivedCampaigns:  0,
    totalBudgetSpent:   0,
    averageCpm:         0,
  };

  return {
    ...result,
    byCategory: categoryBreakdown,
  };
};

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════
module.exports = {
  getCampaigns,
  getCampaignById,
  copyCampaign,
  archiveCampaign,
  restoreCampaign,
  deleteCampaign,
  bulkDeleteCampaigns,
  bulkArchiveCampaigns,
  exportCampaignToCSV,
  getCampaignStatistics,
};