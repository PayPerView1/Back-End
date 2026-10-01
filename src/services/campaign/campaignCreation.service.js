// src/services/campaign/campaignCreation.service.js

const Campaign = require('../../models/campaign');

const {
  uploadFilesToStorage,
  deleteFilesFromStorage,
} = require('./fileUpload.service');

const {
  reviewCampaign,
  mapAIResultToStatus,
  handleAIServiceFailure,
} = require('./aiReview.service');

const { logActivity } = require('./activityLog.service');

const {
  isTransitionAllowed,
} = require('../../utils/campaign/campaignStatus.utils');

const {
  CAMPAIGN_ACTION,
  CAMPAIGN_STATUS,
} = require('../../constants/campaign.constants');


// ============================================
// 5.1.1 — إنشاء الحملة
// ============================================

/**
 * @param {string|ObjectId} advertiserId - صاحب الحملة (req.user._id)
 * @param {Object} campaignData - بيانات الحملة (من req.body، أصلاً اتفحصت بالـ validator)
 * @param {Array} files - الملفات المرفقة (من multer، ممكن تكون مصفوفة فاضية)
 * @param {string} [ipAddress] - عنوان IP للمعلن، للتوثيق بإعلان الحلال
 * @returns {Promise<Object>} مستند الحملة المحفوظ
 */
async function createCampaign(
  advertiserId,
  campaignData,
  files = [],
  ipAddress = ''
) {
  let uploadedMaterials = [];

  try {
    // 1. رفع الملفات المرفقة
    if (files.length > 0) {
      const uploaded = uploadFilesToStorage(files);

      // كل مادة لازم يكون فيها uploadedBy
      uploadedMaterials = uploaded.map((material) => ({
        ...material,
        uploadedBy: advertiserId,
      }));
    }

    // 2. إنشاء مستند الحملة
    const campaign = await Campaign.create({
      advertiserId,
      name: campaignData.name,
      contentType: campaignData.contentType,
      category: campaignData.category,
      subCategories: campaignData.subCategories || [],
      totalBudget: campaignData.totalBudget,

      // ضبط remainingBudget = totalBudget
      remainingBudget: campaignData.totalBudget,

      cpm: campaignData.cpm,
      dailyBudgetLimit: campaignData.dailyBudgetLimit || null,
      brief: campaignData.brief,
      targetCountries: campaignData.targetCountries,
      materials: uploadedMaterials,
      startDate: campaignData.startDate || null,
      endDate: campaignData.endDate || null,
      halalDeclaration: {
        ...campaignData.halalDeclaration,
        declaredBy: advertiserId,
        declaredAt: new Date(),
        ipAddress,
      },
       status: CAMPAIGN_STATUS.PENDING_REVIEW,
       submittedAt: new Date(),
    });

    // 3. تسجيل حدث الإنشاء
    await logActivity(
      campaign._id,
      CAMPAIGN_ACTION.CREATED,
      advertiserId
    );

    return campaign;

  } catch (error) {
    // 4. Rollback
    // لو فشل حفظ الحملة بعد رفع الملفات فعليًا، نحذف الملفات
    if (uploadedMaterials.length > 0) {
      await deleteFilesFromStorage(
        uploadedMaterials.map((m) => m.fileUrl)
      );
    }

    // نرمي الخطأ الأصلي
    throw error;
  }
}


// ============================================
// 5.1.3 — معالجة نتيجة مراجعة الـ AI
// ============================================

/**
 * @param {Object} campaign - مستند الحملة
 * @param {{result: string, score: number, feedback: string}} aiResult
 * @returns {Promise<Object>} الحملة بعد التحديث
 */
async function processAIReviewResult(campaign, aiResult) {
  const newStatus = mapAIResultToStatus(aiResult.result);

  if (!isTransitionAllowed(campaign.status, newStatus)) {
    const error = new Error(
      `Invalid campaign status transition: ${campaign.status} -> ${newStatus}`
    );
    error.statusCode = 409;
    throw error;
  }

  const updateData = {
    status: newStatus,
    'aiReview.result': aiResult.result,
    'aiReview.score': aiResult.score,
    'aiReview.feedback': aiResult.feedback,
    'aiReview.reviewedAt': new Date(),
  };

  if (newStatus === CAMPAIGN_STATUS.ACTIVE) {
    updateData.activatedAt = new Date();
  }

  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaign._id,
    { $set: updateData },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  );

  if (!updatedCampaign) {
    throw new Error(`Campaign not found: ${campaign._id}`);
  }

  const actionMap = {
    [CAMPAIGN_STATUS.ACTIVE]: CAMPAIGN_ACTION.AI_APPROVED,
    [CAMPAIGN_STATUS.REJECTED]: CAMPAIGN_ACTION.AI_REJECTED,
    [CAMPAIGN_STATUS.MANUAL_REVIEW]: CAMPAIGN_ACTION.SENT_TO_MANUAL_REVIEW,
  };

  const action =
    actionMap[updatedCampaign.status] ||
    CAMPAIGN_ACTION.SENT_TO_MANUAL_REVIEW;

  await logActivity(
    updatedCampaign._id,
    action,
    null,
    {
      aiScore: aiResult.score,
      aiFeedback: aiResult.feedback,
    }
  );

  return updatedCampaign;
}


// ============================================
// 5.1.2 — تسليم الحملة للمراجعة (submit)
// ============================================

/**
 * @param {Object} campaign - مستند الحملة (لازم يكون بحالة DRAFT)
 * @returns {Promise<Object>} الحملة بعد المراجعة
 */
async function submitCampaignForReview(campaign) {

  // 1. الانتقال لـ PENDING_REVIEW
  // وتحديث submittedAt مباشرة في MongoDB
  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaign._id,
    {
      $set: {
        status: CAMPAIGN_STATUS.PENDING_REVIEW,
        submittedAt: new Date(),
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  );

  // التأكد أن الحملة موجودة
  if (!updatedCampaign) {
    throw new Error(
      `Campaign not found: ${campaign._id}`
    );
  }

  // 2. تسجيل حدث الإرسال للمراجعة
  await logActivity(
    updatedCampaign._id,
    CAMPAIGN_ACTION.SUBMITTED,
    updatedCampaign.advertiserId
  );

  // 3. استدعاء خدمة الـ AI
  try {
    const aiResult = await reviewCampaign(updatedCampaign);

    return await processAIReviewResult(
      updatedCampaign,
      aiResult
    );

  } catch (error) {

    console.error(
      `[campaignCreation.service] AI review failed for campaign ` +
      `${updatedCampaign._id}: ${error.message}`
    );

    return await handleAIServiceFailure(
      updatedCampaign,
      error.message
    );
  }
}

async function runCampaignAIReview(campaign) {
  // 1. Only allow AI review from PENDING_REVIEW
  if (campaign.status !== CAMPAIGN_STATUS.PENDING_REVIEW) {
    const error = new Error('Campaign is not in PENDING_REVIEW status');
    error.statusCode = 409;
    throw error;
  }

  try {
    // 2. Call AI service
    const aiResult = await reviewCampaign(campaign);

    // 3. Update campaign with AI result
    return await processAIReviewResult(campaign, aiResult);
  } catch (error) {
    // 4. If AI fails, send to manual review
    console.error(
      `[campaignReview.service] AI review failed for campaign ${campaign._id}: ${error.message}`
    );

    return await handleAIServiceFailure(campaign, error.message);
  }
}
// ============================================
// Exports
// ============================================

module.exports = {
  createCampaign,
  submitCampaignForReview,
  processAIReviewResult,
  runCampaignAIReview,
};