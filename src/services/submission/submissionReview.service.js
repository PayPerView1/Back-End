// src/services/submission/submissionReview.service.js
// المالك: المسار ب — منطق مراجعة التسليمات (المعلن والأدمن) + الاعتماد التلقائي.
// المرجع: API_CONTRACT_Sprint5.md §6
//
// ⚠️ لا يعتمد على T3 (submissionDto / submissionGuards) — يبني الـ response مباشرة.

const mongoose = require('mongoose');
const Submission = require('../../models/submission');
const Campaign = require('../../models/campaign');
const { AppError } = require('../../utils/errors');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const {
  notifyCreatorApproved,
  notifyCreatorRejected,
  notifyBrandNewSubmission,
} = require('./submissionNotifications.service');

// ============================================
// Helpers
// ============================================

/**
 * يتحول status المخزّن → displayStatus محسوب
 * (مطابق لـ API Contract §2)
 */
const computeDisplayStatus = (s) => {
  if (s.status === 'WITHDRAWN') return 'WITHDRAWN';
  if (s.status === 'APPROVED') return 'APPROVED';
  if (s.status === 'REJECTED') {
    if (s.rejectedBy === 'AI') return 'AI_REJECTED';
    return 'REJECTED';
  }
  if (s.status === 'SUBMITTED') return 'PROCESSING';
  if (s.status === 'UNDER_REVIEW') {
    if (s.adminReview && s.adminReview.queuedAt && !s.adminReview.decidedAt) {
      return 'MANUAL_REVIEW';
    }
    if (s.advertiserReview && s.advertiserReview.status === 'PENDING') {
      return 'AWAITING_ADVERTISER';
    }
  }
  return s.status;
};

/** يحوّل submission document → response shape (بدون Dto خارجي) */
const toSubmissionListItem = (s, { includeCreator = false } = {}) => {
  const campaign = s.campaignId && typeof s.campaignId === 'object' ? s.campaignId : null;
  const advertiser =
    campaign && campaign.advertiserId && typeof campaign.advertiserId === 'object'
      ? campaign.advertiserId
      : null;

  const base = {
    id: s._id,
    code: s.code || null,
    campaign: campaign
      ? {
          id: campaign._id,
          name: campaign.name,
          brand: advertiser
            ? {
                id: advertiser._id,
                name: advertiser.fullName,
                logo: advertiser.profilePicture || null,
              }
            : null,
        }
      : null,
    platform: s.platform,
    postUrl: s.postUrl,
    displayStatus: computeDisplayStatus(s),
    status: s.status,
    aiScore: s.aiReview?.score ?? null,
    attempt: s.attempt || 1,
    submittedAt: s.submittedAt,
    reviewDeadlineAt: s.reviewDeadlineAt || null,
  };

  if (includeCreator && s.creatorId && typeof s.creatorId === 'object') {
    base.creator = {
      id: s.creatorId._id,
      fullName: s.creatorId.fullName,
      profilePicture: s.creatorId.profilePicture || null,
      country: s.creatorId.country || null,
      city: s.creatorId.city || null,
    };
  }

  return base;
};

/** يحوّل displayStatus → MongoDB filter */
const displayStatusToFilter = (displayStatus) => {
  switch (displayStatus) {
    case 'PROCESSING':
      return { status: 'SUBMITTED' };
    case 'AI_REJECTED':
      return { status: 'REJECTED', rejectedBy: 'AI' };
    case 'MANUAL_REVIEW':
      return {
        status: 'UNDER_REVIEW',
        'adminReview.queuedAt': { $ne: null },
        'adminReview.decidedAt': null,
      };
    case 'AWAITING_ADVERTISER':
      return {
        status: 'UNDER_REVIEW',
        'advertiserReview.status': 'PENDING',
      };
    case 'APPROVED':
      return { status: 'APPROVED' };
    case 'REJECTED':
      return { status: 'REJECTED', rejectedBy: { $in: ['ADVERTISER', 'ADMIN'] } };
    case 'WITHDRAWN':
      return { status: 'WITHDRAWN' };
    default:
      return {};
  }
};

/** يحمّل حملة ويتحقق إنه المستخدم صاحبها */
const loadOwnedCampaign = async (campaignId, advertiserId) => {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }
  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }
  if (campaign.advertiserId.toString() !== advertiserId.toString()) {
    throw new AppError('You are not authorized to access this campaign', 'FORBIDDEN');
  }
  return campaign;
};

// ============================================
// 1. GET /campaigns/:campaignId/submissions — BRAND
// ============================================
const getCampaignSubmissions = async (campaignId, advertiserId, filters = {}) => {
  const campaign = await loadOwnedCampaign(campaignId, advertiserId);

  const { page, perPage, skip } = parsePagination(filters, {
    defaultPerPage: 20,
    maxPerPage: 50,
  });

  const displayStatus = filters.displayStatus || 'AWAITING_ADVERTISER';

  const query = { campaignId: campaign._id };

  if (displayStatus !== 'ALL') {
    Object.assign(query, displayStatusToFilter(displayStatus));
  }

  // ⚠️ PROCESSING و MANUAL_REVIEW لا تُعرض للمعلن
  if (!displayStatus || displayStatus === 'AWAITING_ADVERTISER') {
    query.status = 'UNDER_REVIEW';
    query['advertiserReview.status'] = 'PENDING';
  }

  const [submissions, total] = await Promise.all([
    Submission.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate('campaignId', 'name advertiserId')
      .populate({
        path: 'campaignId',
        populate: { path: 'advertiserId', select: 'fullName profilePicture' },
      })
      .populate('creatorId', 'fullName profilePicture country city')
      .lean(),
    Submission.countDocuments(query),
  ]);

  const data = submissions.map((s) =>
    toSubmissionListItem(s, { includeCreator: true })
  );

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 2. PUT /submissions/:id/review — BRAND
// ============================================
const reviewSubmission = async (submissionId, advertiserId, { decision, note }) => {
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const submission = await Submission.findById(submissionId)
    .populate('campaignId')
    .populate('creatorId', 'fullName email');

  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const campaign = submission.campaignId;
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  if (campaign.advertiserId.toString() !== advertiserId.toString()) {
    throw new AppError('You are not authorized to review this submission', 'FORBIDDEN');
  }

  if (campaign.isSuspended === true) {
    throw new AppError('This campaign is currently suspended', 'CAMPAIGN_SUSPENDED');
  }

  // يجب أن تكون في مرحلة AWAITING_ADVERTISER
  const displayStatus = computeDisplayStatus(submission);
  if (displayStatus !== 'AWAITING_ADVERTISER') {
    throw new AppError('Submission is not awaiting your review', 'SUBMISSION_ALREADY_REVIEWED');
  }

  const now = new Date();

  if (decision === 'APPROVE') {
    // تحديث شرطي
    const updated = await Submission.findOneAndUpdate(
      {
        _id: submission._id,
        status: 'UNDER_REVIEW',
        'advertiserReview.status': 'PENDING',
      },
      {
        $set: {
          status: 'APPROVED',
          reviewedAt: now,
          'advertiserReview.status': 'APPROVED',
          'advertiserReview.reviewedAt': now,
          'advertiserReview.reviewedBy': advertiserId,
          'advertiserReview.note': note || null,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError('Submission is not awaiting your review', 'SUBMISSION_ALREADY_REVIEWED');
    }

    // +1 ذرّياً على stats.totalApprovedVideos
    await Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { 'stats.totalApprovedVideos': 1 } }
    );

    // إشعار للمبدع
    try {
      await notifyCreatorApproved(submission.creatorId, {
        campaignId: campaign._id.toString(),
        submissionId: submission._id.toString(),
        auto: false,
      });
    } catch (err) {
      console.error('[submissionReview.service] notify approved failed:', err.message);
    }

    return {
      id: updated._id,
      status: 'APPROVED',
      displayStatus: 'APPROVED',
      reviewedAt: now,
    };
  }

  // REJECT
  const updated = await Submission.findOneAndUpdate(
    {
      _id: submission._id,
      status: 'UNDER_REVIEW',
      'advertiserReview.status': 'PENDING',
    },
    {
      $set: {
        status: 'REJECTED',
        rejectedBy: 'ADVERTISER',
        reviewedAt: now,
        linkLocked: false,
        'advertiserReview.status': 'REJECTED',
        'advertiserReview.reviewedAt': now,
        'advertiserReview.reviewedBy': advertiserId,
        'advertiserReview.note': note,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError('Submission is not awaiting your review', 'SUBMISSION_ALREADY_REVIEWED');
  }

  try {
    await notifyCreatorRejected(submission.creatorId, {
      campaignId: campaign._id.toString(),
      submissionId: submission._id.toString(),
      note,
    });
  } catch (err) {
    console.error('[submissionReview.service] notify rejected failed:', err.message);
  }

  return {
    id: updated._id,
    status: 'REJECTED',
    displayStatus: 'REJECTED',
    reviewedAt: now,
  };
};

// ============================================
// 3. GET /admin/submissions/manual-review — ADMIN
// ============================================
const getManualReviewQueue = async (filters = {}) => {
  const { page, perPage, skip } = parsePagination(filters, {
    defaultPerPage: 20,
    maxPerPage: 50,
  });

  const query = {
    status: 'UNDER_REVIEW',
    'adminReview.queuedAt': { $ne: null },
    'adminReview.decidedAt': null,
  };

  const [submissions, total] = await Promise.all([
    Submission.find(query)
      .sort({ 'adminReview.queuedAt': 1 }) // الأقدم أولاً
      .skip(skip)
      .limit(perPage)
      .populate('campaignId', 'name advertiserId')
      .populate('creatorId', 'fullName profilePicture country city')
      .lean(),
    Submission.countDocuments(query),
  ]);

  const data = submissions.map((s) => ({
    ...toSubmissionListItem(s, { includeCreator: true }),
    manualReview: {
      reasonCode: s.adminReview?.reasonCode || null,
      queuedAt: s.adminReview?.queuedAt || null,
    },
  }));

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 4. PUT /admin/submissions/:id/review — ADMIN
// ============================================
const decideManualReview = async (submissionId, adminId, { decision, note }) => {
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const submission = await Submission.findById(submissionId).populate('campaignId');
  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const displayStatus = computeDisplayStatus(submission);
  if (displayStatus !== 'MANUAL_REVIEW') {
    throw new AppError('Submission is not in manual review', 'SUBMISSION_ALREADY_REVIEWED');
  }

  const now = new Date();

  if (decision === 'APPROVE') {
    // نقل لمرحلة المعلن
    const deadline = new Date(
      now.getTime() +
        (parseInt(process.env.SUBMISSION_REVIEW_DEADLINE_HOURS, 10) || 24) *
          60 *
          60 *
          1000
    );

    const updated = await Submission.findOneAndUpdate(
      {
        _id: submission._id,
        status: 'UNDER_REVIEW',
        'adminReview.queuedAt': { $ne: null },
        'adminReview.decidedAt': null,
      },
      {
        $set: {
          'adminReview.decidedAt': now,
          'adminReview.decidedBy': adminId,
          'adminReview.note': note || null,
          'advertiserReview.status': 'PENDING',
          reviewDeadlineAt: deadline,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError('Submission is not in manual review', 'SUBMISSION_ALREADY_REVIEWED');
    }

    // إشعار المعلن (NEW_SUBMISSION)
    const campaign = submission.campaignId;
    if (campaign) {
      try {
        await notifyBrandNewSubmission(campaign.advertiserId, {
          campaignId: campaign._id.toString(),
          submissionId: submission._id.toString(),
        });
      } catch (err) {
        console.error('[submissionReview.service] notify brand failed:', err.message);
      }
    }

    return {
      id: updated._id,
      status: updated.status,
      displayStatus: 'AWAITING_ADVERTISER',
      reviewedAt: now,
    };
  }

  // REJECT
  const updated = await Submission.findOneAndUpdate(
    {
      _id: submission._id,
      status: 'UNDER_REVIEW',
      'adminReview.queuedAt': { $ne: null },
      'adminReview.decidedAt': null,
    },
    {
      $set: {
        status: 'REJECTED',
        rejectedBy: 'ADMIN',
        reviewedAt: now,
        linkLocked: false,
        'adminReview.decidedAt': now,
        'adminReview.decidedBy': adminId,
        'adminReview.note': note,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError('Submission is not in manual review', 'SUBMISSION_ALREADY_REVIEWED');
  }

  try {
    await notifyCreatorRejected(submission.creatorId, {
      campaignId: submission.campaignId?._id?.toString(),
      submissionId: submission._id.toString(),
      note,
    });
  } catch (err) {
    console.error('[submissionReview.service] notify rejected failed:', err.message);
  }

  return {
    id: updated._id,
    status: 'REJECTED',
    displayStatus: 'REJECTED',
    reviewedAt: now,
  };
};

// ============================================
// 5. autoApproveDueSubmissions — يُستدعى من الـ job
// ============================================
/**
 * يعتمد تلقائياً كل التسليمات التي تجاوزت reviewDeadlineAt
 * @returns {Promise<{ processed: number, approved: number }>}
 */
const autoApproveDueSubmissions = async () => {
  if (process.env.ENABLE_SUBMISSION_AUTO_APPROVE === 'false') {
    return { processed: 0, approved: 0 };
  }

  const now = new Date();

  const dueSubmissions = await Submission.find({
    status: 'UNDER_REVIEW',
    'advertiserReview.status': 'PENDING',
    reviewDeadlineAt: { $lte: now },
  })
    .populate('campaignId', 'advertiserId')
    .populate('creatorId', 'fullName email')
    .lean();

  let approved = 0;

  for (const s of dueSubmissions) {
    const updated = await Submission.findOneAndUpdate(
      {
        _id: s._id,
        status: 'UNDER_REVIEW',
        'advertiserReview.status': 'PENDING',
        reviewDeadlineAt: { $lte: now },
      },
      {
        $set: {
          status: 'APPROVED',
          reviewedAt: now,
          'advertiserReview.status': 'AUTO_APPROVED',
          'advertiserReview.reviewedAt': now,
        },
      },
      { new: true }
    );

    if (updated) {
      approved += 1;

      // +1 على stats
      if (s.campaignId) {
        await Campaign.updateOne(
          { _id: s.campaignId._id },
          { $inc: { 'stats.totalApprovedVideos': 1 } }
        );
      }

      try {
        await notifyCreatorApproved(s.creatorId, {
          campaignId: s.campaignId?._id?.toString(),
          submissionId: s._id.toString(),
          auto: true,
        });
      } catch (err) {
        console.error('[submissionReview.service] auto-approve notify failed:', err.message);
      }
    }
  }

  return { processed: dueSubmissions.length, approved };
};

module.exports = {
  getCampaignSubmissions,
  reviewSubmission,
  getManualReviewQueue,
  decideManualReview,
  autoApproveDueSubmissions,
  // exports helpers for reuse
  computeDisplayStatus,
  toSubmissionListItem,
  displayStatusToFilter,
};