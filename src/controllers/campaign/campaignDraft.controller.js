// src/controllers/campaign/campaignDraft.controller.js
const draftService = require('../../services/campaign/campaignDraft.service');
const { uploadCoverImage, uploadFilesToStorage } = require('../../services/campaign/fileUpload.service');
// ============================================
// 6.2.1 — POST /api/v1/campaigns/drafts
// ============================================
const createDraft = async (req, res) => {
  try {
    const advertiserId = req.user._id;
    const materials = req.files?.materials || [];
    const coverImageFile = req.files?.coverImage?.[0] || null;

    // 1. رفع صورة الغلاف إذا وجدت
    let coverImageData = null;
    if (coverImageFile) {
      coverImageData = await uploadCoverImage(coverImageFile);
    }

    // 2. رفع المواد إذا وجدت
    let uploadedMaterials = [];
    if (materials.length > 0) {
      uploadedMaterials = await uploadFilesToStorage(materials);
    }

    // 3. تجهيز البيانات وتمريرها للـ Service
    const draftData = {
      ...req.body,
      coverImage: coverImageData?.url || null,
      coverImagePublicId: coverImageData?.publicId || null,
      materials: uploadedMaterials,
    };

    const draft = await draftService.createDraft(advertiserId, draftData);

    res.status(201).json({
      success: true,
      message: 'Draft created successfully',
      draft,
    });
  } catch (error) {
    console.error('[campaignDraft.controller] createDraft error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error while creating draft' });
  }
};

// ============================================
// 6.2.2 — GET /api/v1/campaigns/drafts/:draftId
// ============================================
/**
 * ⚠️ بيعتمد على verifyDraftOwnership يلي بيحط المسودة أصلاً بـ req.draft
 */
const getDraft = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      draft: req.draft,
    });
  } catch (error) {
    console.error(`[campaignDraft.controller] getDraft error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error while fetching draft' });
  }
};

// ============================================
// GET /api/v1/campaigns/drafts
// ============================================
const getAllDrafts = async (req, res) => {
  try {
    const drafts = await draftService.getAllDrafts(req.user._id);

    res.status(200).json({
      success: true,
      count: drafts.length,
      drafts,
    });
  } catch (error) {
    console.error('[campaignDraft.controller] getAllDrafts error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching drafts' });
  }
};
// ============================================
// 6.2.3 — PUT /api/v1/campaigns/drafts/:draftId
// ============================================
const updateDraft = async (req, res) => {
  try {
    const materials = req.files?.materials || [];
    const coverImageFile = req.files?.coverImage?.[0] || null;

    let coverImageData = null;
    if (coverImageFile) {
      coverImageData = await uploadCoverImage(coverImageFile);
    }

    let uploadedMaterials = [];
    if (materials.length > 0) {
      uploadedMaterials = await uploadFilesToStorage(materials);
    }

    const updateData = { ...req.body };
    if (coverImageData) {
      updateData.coverImage = coverImageData.url;
      updateData.coverImagePublicId = coverImageData.publicId;
    }
    if (uploadedMaterials.length > 0) {
      // ملاحظة: هذا سيستبدل المصفوفة القديمة بالكامل. إذا أردت الإضافة فقط، يجب تعديل الـ Service.
      updateData.materials = uploadedMaterials; 
    }

    const updatedDraft = await draftService.updateDraft(req.draft, updateData);

    res.status(200).json({
      success: true,
      message: 'Draft updated successfully',
      draft: updatedDraft,
    });
  } catch (error) {
    console.error(`[campaignDraft.controller] updateDraft error: ${error.message}`);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.statusCode ? error.message : 'Server error while updating draft',
    });
  }
};

// ============================================
// 6.2.4 — DELETE /api/v1/campaigns/drafts/:draftId
// ============================================
const deleteDraft = async (req, res) => {
  try {
    await draftService.deleteDraft(req.draft);

    res.status(200).json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    console.error(`[campaignDraft.controller] deleteDraft error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error while deleting draft' });
  }
};

// ============================================
// 6.2.5 — PATCH /api/v1/campaigns/drafts/:draftId/auto-save
// ============================================
const autoSaveDraft = async (req, res) => {
  try {
    // clientVersion المفروض توصل بالـ body (مصدرها الفرونت إند، النسخة يلي كانت عندو وقت بلش يعدل)
    const { clientVersion, ...updateData } = req.body;

    if (clientVersion === undefined) {
      return res.status(400).json({
        success: false,
        message: 'clientVersion is required for auto-save',
      });
    }

    const updatedDraft = await draftService.autoSaveDraft(req.draft, updateData, clientVersion);

    res.status(200).json({
      success: true,
      message: 'Draft auto-saved successfully',
      draft: updatedDraft,
    });
  } catch (error) {
    console.error(`[campaignDraft.controller] autoSaveDraft error: ${error.message}`);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.statusCode ? error.message : 'Server error during auto-save',
    });
  }
};

// ============================================
// 6.2.6 — POST /api/v1/campaigns/drafts/:draftId/submit
// ============================================
/**
 * ⚠️ req.finalCampaignData جاهزة أصلاً من validateDraftSubmission middleware
 */
const submitDraft = async (req, res) => {
  try {
    const campaign = await draftService.submitDraft(req.draft, req.finalCampaignData, req.ip);

    res.status(201).json({
      success: true,
      message: 'Draft submitted and campaign created successfully',
      campaign,
    });
  } catch (error) {
    console.error(`[campaignDraft.controller] submitDraft error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error while submitting draft' });
  }
};

const getExpiredDrafts = async (req, res) => {
  try {
    const drafts = await draftService.getExpiredDrafts(req.user._id);

    res.status(200).json({
      success: true,
      count: drafts.length,
      drafts,
    });
  } catch (error) {
    console.error('[campaignDraft.controller] getExpiredDrafts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching expired drafts',
    });
  }
};

module.exports = {
  createDraft,
  getDraft,
  getAllDrafts,
  updateDraft,
  deleteDraft,
  autoSaveDraft,
  submitDraft,
  getExpiredDrafts,
};