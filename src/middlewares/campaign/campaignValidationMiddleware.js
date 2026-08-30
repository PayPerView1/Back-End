// src/middlewares/campaign/campaignValidationMiddleware.js
const mongoose = require('mongoose');
const Campaign = require('../../models/campaign');
const CampaignDraft = require('../../models/CampaignDraft');

/**
 * middleware بيتحقق إنو الحملة (Campaign) موجودة فعليًا، وإنو المستخدم الحالي
 * هو صاحبها (advertiser) قبل ما يسمحله يشوفها أو يعدلها أو يحذفها.
 *
 * بيتوقع إنو الـ route فيه param اسمه :campaignId
 * لو نجح الفحص، بيحط الحملة نفسها بـ req.campaign عشان الكونترولر ما يضطر
 * يجيبها مرة تانية من قاعدة البيانات (تجنب استعلام مكرر).
 */
const verifyCampaignOwnership = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    // 1. التحقق من شكل الـ id قبل ما نحاول نستعلم فيه أصلاً
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign id format',
      });
    }

    // 2. جلب الحملة
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    // 3. التحقق من الملكية — المستخدم الحالي لازم يكون صاحب الحملة نفسه
    if (campaign.advertiserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this campaign',
      });
    }

    // 4. نحط الحملة بالـ request عشان الكونترولر يستخدمها مباشرة بدون استعلام إضافي
    req.campaign = campaign;

    next();
  } catch (error) {
    console.error(`[campaignValidationMiddleware] verifyCampaignOwnership error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying campaign ownership',
    });
  }
};

/**
 * نفس فكرة verifyCampaignOwnership تمامًا، بس للمسودات (CampaignDraft) بدل الحملات الفعلية.
 * بيتوقع إنو الـ route فيه param اسمه :draftId
 * لو نجح الفحص، بيحط المسودة بـ req.draft.
 */
const verifyDraftOwnership = async (req, res, next) => {
  try {
    const { draftId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid draft id format',
      });
    }

    const draft = await CampaignDraft.findById(draftId);

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found',
      });
    }

    if (draft.advertiserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this draft',
      });
    }

    req.draft = draft;

    next();
  } catch (error) {
    console.error(`[campaignValidationMiddleware] verifyDraftOwnership error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying draft ownership',
    });
  }
};

/**
 * middleware بيتحقق إنو المستخدم الحالي عنده role = 'BRAND'.
 * إنشاء/تعديل الحملات مسموح بس للحسابات التجارية (Brand)، مش لكل مستخدم
 * (مثلاً حسابات CLIPPER ما إلها داعي تنشئ حملات).
 *
 * ⚠️ لازم يجي بعد authMiddleware بالسلسلة (محتاج req.user جاهز أصلاً).
 */
const requireBrandRole = (req, res, next) => {
  if (!req.user || req.user.role !== 'BRAND') {
    return res.status(403).json({
      success: false,
      message: 'Only brand accounts can perform this action',
    });
  }

  next();
};

module.exports = {
  verifyCampaignOwnership,
  verifyDraftOwnership,
  requireBrandRole,
};