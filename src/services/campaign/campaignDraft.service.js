// src/services/campaign/campaignDraft.service.js
const CampaignDraft = require('../../models/CampaignDraft');
const User = require('../../models/user');
const sendEmail = require('../emailService');
const { deleteFilesFromStorage } = require('./fileUpload.service');
const { logActivity } = require('./activityLog.service');
const { createCampaign, submitCampaignForReview } = require('./campaignCreation.service');
const { CAMPAIGN_ACTION } = require('../../constants/campaign.constants');

// ============================================
// 6.1.1 — إنشاء مسودة جديدة
// ============================================
/**
 * @param {string|ObjectId} advertiserId
 * @param {Object} draftData - على الأقل { name }
 * @returns {Promise<Object>}
 */
async function createDraft(advertiserId, draftData) {
  // expiresAt و version عندهم default بالـ schema نفسها (DRAFT_EXPIRY_DAYS و 1)
  // فما محتاجين نحددهم يدويًا هون إلا لو بدنا نتجاوزهم بشكل صريح
  const draft = await CampaignDraft.create({
    advertiserId,
    name: draftData.name,
  });

  await logActivity(draft._id, CAMPAIGN_ACTION.CREATED, advertiserId, { type: 'DRAFT' });

  return draft;
}

// ============================================
// 6.1.2 — جلب مسودة بالتفصيل
// ============================================
/**
 * ⚠️ ملاحظة: فحص الـ ownership أصلاً بيصير بـ verifyDraftOwnership middleware
 * (المرحلة 1)، فهاي الدالة هون بسيطة — بس بترجع المسودة. تركتها بنفس التوقيع
 * يلي بالخطة (draftId, advertiserId) لأي استخدام مباشر مستقبلي بدون الـ middleware.
 */
async function getDraftById(draftId, advertiserId) {
  const draft = await CampaignDraft.findOne({ _id: draftId, advertiserId });
  return draft;
}

// ============================================
// 6.1.3 — تحديث مسودة
// ============================================
/**
 * @param {Object} draft - مستند المسودة (جاي من req.draft عبر verifyDraftOwnership)
 * @param {Object} updateData - الحقول المطلوب تحديثها
 * @returns {Promise<Object>} المسودة بعد التحديث
 * @throws {Error} لو المسودة منتهية الصلاحية (EXPIRED)
 */
async function updateDraft(draft, updateData) {
  if (draft.status === 'EXPIRED') {
    const error = new Error('This draft has expired and cannot be updated');
    error.statusCode = 400;
    throw error;
  }

  // بنحدث بس الحقول المرسلة فعليًا (نفس فلسفة updateProfile بالبروفايل)
  const allowedFields = [
    'name',
    'contentType',
    'category',
    'subCategories',
    'totalBudget',
    'cpm',
    'dailyBudgetLimit',
    'brief',
    'targetCountries',
    'halalDeclared',
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      draft[field] = updateData[field];
    }
  });

  draft.version += 1;
  draft.lastSavedAt = new Date();

  await draft.save();

  await logActivity(draft._id, CAMPAIGN_ACTION.UPDATED, draft.advertiserId, { type: 'DRAFT' });

  return draft;
}

// ============================================
// 6.1.4 — حفظ تلقائي (Auto-save) مع فحص تعارض النسخ
// ============================================
/**
 * @param {Object} draft - مستند المسودة
 * @param {Object} updateData
 * @param {number} clientVersion - رقم النسخة يلي كانت عند العميل وقت ما بلش التعديل
 * @returns {Promise<Object>} المسودة بعد التحديث
 * @throws {Error} برمز statusCode=409 لو صار تعارض نسخ
 */
async function autoSaveDraft(draft, updateData, clientVersion) {
  if (draft.status === 'EXPIRED') {
    const error = new Error('This draft has expired and cannot be updated');
    error.statusCode = 400;
    throw error;
  }

  // لو نسخة العميل أقل من النسخة الحالية بقاعدة البيانات، معناها في تعديل تاني
  // صار بالمنتصف (مثلاً من تبويب/جهاز تاني) — نرفض ونخلي العميل يحدث نسخته أول
  if (clientVersion < draft.version) {
    const error = new Error('Version conflict: this draft was updated elsewhere. Please refresh and try again.');
    error.statusCode = 409;
    throw error;
  }

  const allowedFields = [
    'name',
    'contentType',
    'category',
    'subCategories',
    'totalBudget',
    'cpm',
    'dailyBudgetLimit',
    'brief',
    'targetCountries',
    'halalDeclared',
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      draft[field] = updateData[field];
    }
  });

  draft.version += 1;
  draft.lastSavedAt = new Date();

  await draft.save();

  return draft;
}

// ============================================
// 6.1.5 — حذف مسودة
// ============================================
/**
 * @param {Object} draft - مستند المسودة
 */
async function deleteDraft(draft) {
  // حذف الملفات المرفقة من التخزين أول (لو في أي مواد مرفوعة)
  if (draft.materials && draft.materials.length > 0) {
    const fileUrls = draft.materials.map((m) => m.fileUrl);
    await deleteFilesFromStorage(fileUrls);
  }

  const draftId = draft._id;
  const advertiserId = draft.advertiserId;

  await CampaignDraft.deleteOne({ _id: draftId });

  await logActivity(draftId, CAMPAIGN_ACTION.DELETED, advertiserId, { type: 'DRAFT' });
}

// ============================================
// 6.1.6 — تسليم المسودة (تحويلها لحملة فعلية)
// ============================================
/**
 * ⚠️ finalData لازم يكون جاهز أصلاً (مدموج ومفحوص) من validateDraftSubmission
 * middleware — موجود بـ req.finalCampaignData
 *
 * @param {Object} draft - مستند المسودة
 * @param {Object} finalData - بيانات الحملة الكاملة والمفحوصة (draft + halalDeclaration الكاملة)
 * @param {string} [ipAddress]
 * @returns {Promise<Object>} الحملة الجديدة بعد الإنشاء والمراجعة
 */
async function submitDraft(draft, finalData, ipAddress = '') {
  const advertiserId = draft.advertiserId;

  // 1. تحويل مواد المسودة لشكل متوافق مع materials تبع الحملة الفعلية
  //    (draftMaterialSchema وmaterialSchema متطابقين تقريبًا، بس ناقصهم uploadedBy)
  const existingMaterials = (draft.materials || []).map((m) => ({
    fileName: m.fileName,
    fileUrl: m.fileUrl,
    fileType: m.fileType,
    fileSizeKb: m.fileSizeKb,
    mimeType: m.mimeType,
  }));

  // 2. إنشاء الحملة الفعلية — بنمرر مصفوفة ملفات فاضية لأنو الملفات أصلاً
  //    مرفوعة ومخزنة من وقت التسويد، منحطهم يدويًا بعد الإنشاء
  const campaign = await createCampaign(advertiserId, finalData, [], ipAddress);

  if (existingMaterials.length > 0) {
    campaign.materials = existingMaterials.map((m) => ({ ...m, uploadedBy: advertiserId }));
    await campaign.save();
  }

  // 3. تسليمها فورًا للمراجعة (AI review) — نفس مسار POST /campaigns العادي
  const reviewedCampaign = await submitCampaignForReview(campaign);

  // 4. حذف المسودة بعد النجاح (حسب الخطة — بدون حذف الملفات، لأنها انتقلت للحملة الجديدة)
  await CampaignDraft.deleteOne({ _id: draft._id });

  await logActivity(campaign._id, CAMPAIGN_ACTION.SUBMITTED, advertiserId, {
    fromDraftId: draft._id,
  });

  return reviewedCampaign;
}

// ============================================
// 7.1.2 — انتهاء صلاحية المسودات (تُستخدم من الـ cron job)
// ============================================
/**
 * بتدور على كل المسودات يلي تجاوزت expiresAt ولسا بحالة DRAFT، وتحولهم لـ EXPIRED،
 * وبترسل إشعار إيميل لكل معلن عن مسودته يلي انتهت
 * @returns {Promise<number>} عدد المسودات يلي اتحولت
 */
async function expireDrafts() {
  const now = new Date();

  // 1. نجيب المسودات يلي بدها تنتهي *قبل* ما نحولهم، عشان نعرف مين نبعتلهم إيميل
  const expiringDrafts = await CampaignDraft.find({
    expiresAt: { $lt: now },
    status: 'DRAFT',
  });

  if (expiringDrafts.length === 0) {
    return 0;
  }

  // 2. نحولهم فعليًا لـ EXPIRED
  await CampaignDraft.updateMany(
    { _id: { $in: expiringDrafts.map((d) => d._id) } },
    { $set: { status: 'EXPIRED' } }
  );

  // 3. نبعت إيميل لكل معلن — كل واحد لحاله، وبدون ما نوقف الباقي لو وحدة فشلت
  for (const draft of expiringDrafts) {
    try {
      const advertiser = await User.findById(draft.advertiserId);

      if (!advertiser || !advertiser.email) {
        console.error(`[campaignDraft.service] No email found for advertiser ${draft.advertiserId}, skipping notification`);
        continue;
      }

      await sendEmail({
        email: advertiser.email,
        subject: 'Your campaign draft has expired',
        message: `Your draft "${draft.name}" has expired after 30 days of inactivity. You can no longer submit it, but it will remain in your account for reference.`,
      });
    } catch (error) {
      // نفس فلسفة باقي الملف — فشل إيميل واحد ما لازم يوقف باقي المسودات
      console.error(`[campaignDraft.service] Failed to send expiry email for draft ${draft._id}: ${error.message}`);
    }
  }

  return expiringDrafts.length;
}

module.exports = {
  createDraft,
  getDraftById,
  updateDraft,
  autoSaveDraft,
  deleteDraft,
  submitDraft,
  expireDrafts,
};