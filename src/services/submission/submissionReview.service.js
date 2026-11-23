// src/services/submission/submissionReview.service.js
// المالك: المسار ب — مراجعة التسليمات (المعلن والأدمن) + الاعتماد التلقائي.
// المرجع: API_CONTRACT_Sprint5.md §6

const mongoose = require('mongoose');
const Submission = require('../../models/submission');
const Campaign = require('../../models/campaign');
const { AppError } = require('../../utils/errors');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const {
  SUBMISSION_STATUS,
  ADVERTISER_STATUS,
  REJECTED_BY,
  SUBMISSION_CONFIG,
  getDisplayStatus,
  DISPLAY_STATUS,
} = require('../../constants/submission.constants');
const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');
const { toListItem, toDetail } = require('../../utils/submission/submissionDto.utils');
const {
  notifyCreatorApproved,
  notifyCreatorRejected,
  notifyCreatorEditsRequested,
  notifyBrandNewSubmission,
} = require('./submissionNotifications.service');

// ============================================
// Helpers
// ============================================

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const loadOwnedCampaign = async (campaignId, advertiserId) => {
  if (!isValidId(campaignId)) {
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

/** يحوّل displayStatus → MongoDB filter (متوافق مع getDisplayStatus) */
const displayStatusToFilter = (displayStatus) => {
  const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');

  switch (displayStatus) {
    case DISPLAY_STATUS.PROCESSING:
      return { status: SUBMISSION_STATUS.SUBMITTED };
    case DISPLAY_STATUS.AI_REJECTED:
      return {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: { $in: [REJECTED_BY.AI, REJECTED_BY.RULES] },
      };
    case DISPLAY_STATUS.MANUAL_REVIEW:
      return {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        'aiReview.status': AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
        $or: [
          { 'adminReview.decision': null },
          { 'adminReview.decision': { $exists: false } },
        ],
      };
    case DISPLAY_STATUS.AWAITING_ADVERTISER:
      return {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        'advertiserReview.status': ADVERTISER_STATUS.PENDING,
        $or: [
          { 'aiReview.status': { $ne: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED } },
          { 'adminReview.decision': { $ne: null } },
        ],
      };
    case DISPLAY_STATUS.APPROVED:
      return { status: SUBMISSION_STATUS.APPROVED };
    case DISPLAY_STATUS.REJECTED:
      return {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: { $in: [REJECTED_BY.ADVERTISER, REJECTED_BY.ADMIN] },
        'advertiserReview.status': { $ne: ADVERTISER_STATUS.CHANGES_REQUESTED },
      };
    case DISPLAY_STATUS.CHANGES_REQUESTED:
      return {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: REJECTED_BY.ADVERTISER,
        'advertiserReview.status': ADVERTISER_STATUS.CHANGES_REQUESTED,
      };
    case DISPLAY_STATUS.WITHDRAWN:
      return { status: SUBMISSION_STATUS.WITHDRAWN };
    default:
      return {};
  }
};

/**
 * يبني كائن submission نظيف للإشعارات (creatorId ObjectId، بدون populate)
 */
const toNotificationPayload = (doc) => {
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: raw._id,
    creatorId: raw.creatorId,
    rejectionReasons: raw.rejectionReasons,
  };
};

const toNotificationCampaign = (campaign) => {
  const raw = typeof campaign.toObject === 'function' ? campaign.toObject() : campaign;
  return {
    _id: raw._id,
    name: raw.name,
    advertiserId: raw.advertiserId,
  };
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

  const displayStatus = filters.displayStatus || DISPLAY_STATUS.AWAITING_ADVERTISER;

  const query = { campaignId: campaign._id };

  if (displayStatus !== 'ALL') {
    Object.assign(query, displayStatusToFilter(displayStatus));
  }

  // ⚠️ PROCESSING و MANUAL_REVIEW لا تُعرض للمعلن — نستثنيهم دايماً
  const excludeStatuses = [
    DISPLAY_STATUS.PROCESSING,
    DISPLAY_STATUS.MANUAL_REVIEW,
  ];

  if (displayStatus === 'ALL') {
    // نستثني PROCESSING و MANUAL_REVIEW
    const excludeProcessing = displayStatusToFilter(DISPLAY_STATUS.PROCESSING);
    const excludeManual = displayStatusToFilter(DISPLAY_STATUS.MANUAL_REVIEW);
    query.$nor = [excludeProcessing, excludeManual];
  }

  const [submissions, total] = await Promise.all([
    Submission.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: 'campaignId',
        select: 'name advertiserId',
        populate: { path: 'advertiserId', select: 'fullName profilePicture' },
      })
      .populate('creatorId', 'fullName profilePicture country city')
      .lean(),
    Submission.countDocuments(query),
  ]);

  const data = submissions.map((s) => {
    // العقد §6.1: عناصر القائمة تتضمن preview/checks/summary
    const { preview, checks, summary } = toDetail(s, { campaign: s.campaignId });
    return {
      ...toListItem(s, { campaign: s.campaignId }),
      creator: s.creatorId
        ? {
            id: s.creatorId._id,
            fullName: s.creatorId.fullName,
            profilePicture: s.creatorId.profilePicture || null,
            country: s.creatorId.country || null,
            city: s.creatorId.city || null,
          }
        : null,
      preview,
      checks,
      summary,
    };
  });

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 2. PUT /submissions/:id/review — BRAND
// ============================================
const reviewSubmission = async (submissionId, advertiserId, { decision, note }) => {
  if (!isValidId(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const now = new Date();
  const session = await mongoose.startSession();
  let submission;
  let campaign;
  let updated;

  try {
    await session.withTransaction(async () => {
      submission = await Submission.findById(submissionId).session(session);
      if (!submission) throw new AppError('Submission not found', 'NOT_FOUND');

      campaign = await Campaign.findById(submission.campaignId).session(session);
      if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');
      if (campaign.advertiserId.toString() !== advertiserId.toString()) {
        throw new AppError('You are not authorized to review this submission', 'FORBIDDEN');
      }
      if (campaign.isSuspended === true) {
        throw new AppError('This campaign is currently suspended', 'CAMPAIGN_SUSPENDED');
      }
      if (getDisplayStatus(submission) !== DISPLAY_STATUS.AWAITING_ADVERTISER) {
        throw new AppError('Submission is not awaiting your review', 'SUBMISSION_ALREADY_REVIEWED');
      }

      const isApprove = decision === 'APPROVE';
      const requestsEdits = decision === 'REQUEST_EDITS';
      const advertiserStatus = isApprove
        ? ADVERTISER_STATUS.APPROVED
        : requestsEdits
          ? ADVERTISER_STATUS.CHANGES_REQUESTED
          : ADVERTISER_STATUS.REJECTED;

      const reviewUpdate = {
        $set: {
          status: isApprove ? SUBMISSION_STATUS.APPROVED : SUBMISSION_STATUS.REJECTED,
          rejectedBy: isApprove ? null : REJECTED_BY.ADVERTISER,
          reviewedAt: now,
          approvedAt: isApprove ? now : null,
          linkLocked: isApprove,
          'advertiserReview.status': advertiserStatus,
          'advertiserReview.reviewedAt': now,
          'advertiserReview.reviewedBy': advertiserId,
          'advertiserReview.note': note || '',
        },
      };
      if (!isApprove && note) {
        reviewUpdate.$push = {
          rejectionReasons: {
            code: requestsEdits ? 'EDITS_REQUESTED' : 'ADVERTISER_REJECTION',
            message: note,
          },
        };
      }

      updated = await Submission.findOneAndUpdate(
        {
          _id: submission._id,
          status: SUBMISSION_STATUS.UNDER_REVIEW,
          'advertiserReview.status': ADVERTISER_STATUS.PENDING,
        },
        reviewUpdate,
        { new: true, session }
      );

      if (!updated) {
        throw new AppError('Submission is not awaiting your review', 'SUBMISSION_ALREADY_REVIEWED');
      }

      if (isApprove) {
        await Campaign.updateOne(
          { _id: campaign._id },
          { $inc: { 'stats.totalApprovedVideos': 1 } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const submissionPayload = toNotificationPayload(submission);
  const campaignPayload = toNotificationCampaign(campaign);
  if (decision === 'APPROVE') {
    await notifyCreatorApproved(submissionPayload, campaignPayload, { auto: false });
  } else if (decision === 'REQUEST_EDITS') {
    await notifyCreatorEditsRequested(submissionPayload, campaignPayload, { note });
  } else {
    await notifyCreatorRejected(submissionPayload, campaignPayload, { note });
  }

  return {
    id: updated._id,
    status: updated.status,
    displayStatus: getDisplayStatus(updated),
    reviewedAt: now,
  };
};

const bulkReviewSubmissions = async (campaignId, advertiserId, { submissionIds, decision, note = '' }) => {
  if (!isValidId(campaignId) || !Array.isArray(submissionIds) || submissionIds.length === 0) {
    throw new AppError('Invalid campaign or submission identifiers', 'VALIDATION_ERROR');
  }
  if (!['APPROVE', 'REJECT'].includes(decision)) {
    throw new AppError('Bulk review decision must be APPROVE or REJECT', 'VALIDATION_ERROR');
  }
  if (decision === 'REJECT' && !String(note).trim()) {
    throw new AppError('A review note is required when rejecting submissions', 'VALIDATION_ERROR');
  }
  if (submissionIds.some((id) => !isValidId(id)) || new Set(submissionIds.map(String)).size !== submissionIds.length) {
    throw new AppError('Submission identifiers must be valid and unique', 'VALIDATION_ERROR');
  }

  const now = new Date();
  const session = await mongoose.startSession();
  let campaign;
  let reviewed = [];
  try {
    await session.withTransaction(async () => {
      reviewed = [];
      campaign = await Campaign.findById(campaignId).session(session);
      if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');
      if (campaign.advertiserId.toString() !== advertiserId.toString()) {
        throw new AppError('You are not authorized to review this campaign', 'FORBIDDEN');
      }
      if (campaign.isSuspended === true) {
        throw new AppError('This campaign is currently suspended', 'CAMPAIGN_SUSPENDED');
      }

      const candidates = await Submission.find({
        _id: { $in: submissionIds },
        campaignId,
      }).session(session);
      if (candidates.length !== submissionIds.length) {
        throw new AppError('One or more submissions were not found in this campaign', 'NOT_FOUND');
      }
      if (candidates.some((item) => getDisplayStatus(item) !== DISPLAY_STATUS.AWAITING_ADVERTISER)) {
        throw new AppError('Every submission must be awaiting advertiser review', 'SUBMISSION_ALREADY_REVIEWED');
      }

      const isApprove = decision === 'APPROVE';
      for (const candidate of candidates) {
        const result = await Submission.findOneAndUpdate(
          {
            _id: candidate._id,
            campaignId,
            status: SUBMISSION_STATUS.UNDER_REVIEW,
            'advertiserReview.status': ADVERTISER_STATUS.PENDING,
          },
          {
            $set: {
              status: isApprove ? SUBMISSION_STATUS.APPROVED : SUBMISSION_STATUS.REJECTED,
              rejectedBy: isApprove ? null : REJECTED_BY.ADVERTISER,
              reviewedAt: now,
              approvedAt: isApprove ? now : null,
              linkLocked: isApprove,
              'advertiserReview.status': isApprove ? ADVERTISER_STATUS.APPROVED : ADVERTISER_STATUS.REJECTED,
              'advertiserReview.reviewedAt': now,
              'advertiserReview.reviewedBy': advertiserId,
              'advertiserReview.note': isApprove ? '' : String(note).trim(),
            },
            ...(isApprove ? {} : {
              $push: { rejectionReasons: { code: 'ADVERTISER_REJECTION', message: String(note).trim() } },
            }),
          },
          { new: true, session }
        );
        if (!result) throw new AppError('A submission was reviewed concurrently', 'SUBMISSION_ALREADY_REVIEWED');
        reviewed.push(result);
      }

      if (decision === 'APPROVE') {
        await Campaign.updateOne(
          { _id: campaignId },
          { $inc: { 'stats.totalApprovedVideos': reviewed.length } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  await Promise.all(reviewed.map((item) => decision === 'APPROVE'
    ? notifyCreatorApproved(toNotificationPayload(item), toNotificationCampaign(campaign), { auto: false })
    : notifyCreatorRejected(toNotificationPayload(item), toNotificationCampaign(campaign), { note: String(note).trim() })
  ));

  return {
    campaignId: campaign._id,
    decision,
    reviewedCount: reviewed.length,
    approvedCount: decision === 'APPROVE' ? reviewed.length : 0,
    rejectedCount: decision === 'REJECT' ? reviewed.length : 0,
    submissionIds: reviewed.map((item) => item._id),
    reviewedAt: now,
  };
};

const bulkApproveSubmissions = async (campaignId, advertiserId, submissionIds) => {
  const result = await bulkReviewSubmissions(campaignId, advertiserId, {
    submissionIds,
    decision: 'APPROVE',
  });
  return {
    campaignId: result.campaignId,
    approvedCount: result.approvedCount,
    submissionIds: result.submissionIds,
    reviewedAt: result.reviewedAt,
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

  const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');

  const query = {
    status: SUBMISSION_STATUS.UNDER_REVIEW,
    'aiReview.status': AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
    $or: [
      { 'adminReview.decision': null },
      { 'adminReview.decision': { $exists: false } },
    ],
  };

  const [submissions, total] = await Promise.all([
    Submission.find(query)
      .sort({ 'adminReview.queuedAt': 1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: 'campaignId',
        select: 'name advertiserId',
        populate: { path: 'advertiserId', select: 'fullName profilePicture' },
      })
      .populate('creatorId', 'fullName profilePicture country city')
      .lean(),
    Submission.countDocuments(query),
  ]);

  const data = submissions.map((s) => {
    // العقد §6.3: عناصر الطابور تتضمن preview/checks
    const { preview, checks } = toDetail(s, { campaign: s.campaignId });
    return {
      ...toListItem(s, { campaign: s.campaignId }),
      creator: s.creatorId
        ? {
            id: s.creatorId._id,
            fullName: s.creatorId.fullName,
            profilePicture: s.creatorId.profilePicture || null,
            country: s.creatorId.country || null,
            city: s.creatorId.city || null,
          }
        : null,
      preview,
      checks,
      manualReview: {
        reasonCode: s.adminReview?.reasonCode || null,
        queuedAt: s.adminReview?.queuedAt || null,
      },
    };
  });

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 4. PUT /admin/submissions/:id/review — ADMIN
// ============================================
const decideManualReview = async (submissionId, adminId, { decision, note }) => {
  if (!isValidId(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const submission = await Submission.findById(submissionId).populate('campaignId');
  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const displayStatus = getDisplayStatus(submission);
  if (displayStatus !== DISPLAY_STATUS.MANUAL_REVIEW) {
    throw new AppError('Submission is not in manual review', 'SUBMISSION_ALREADY_REVIEWED');
  }

  const now = new Date();

  if (decision === 'APPROVE') {
    const deadline = new Date(
      now.getTime() + SUBMISSION_CONFIG.REVIEW_DEADLINE_HOURS * 60 * 60 * 1000
    );

    const updated = await Submission.findOneAndUpdate(
      {
        _id: submission._id,
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        'aiReview.status': require('../../constants/campaign.constants').AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
        $or: [
          { 'adminReview.decision': null },
          { 'adminReview.decision': { $exists: false } },
        ],
      },
      {
        $set: {
          'adminReview.decision': 'APPROVE',
          'adminReview.reviewedAt': now,
          'adminReview.reviewedBy': adminId,
          'adminReview.note': note || null,
          'advertiserReview.status': ADVERTISER_STATUS.PENDING,
          reviewDeadlineAt: deadline,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError('Submission is not in manual review', 'SUBMISSION_ALREADY_REVIEWED');
    }

    const campaign = submission.campaignId;
    if (campaign) {
      try {
        await notifyBrandNewSubmission(
          toNotificationPayload(submission),
          toNotificationCampaign(campaign)
        );
      } catch (err) {
        console.error('[submissionReview.service] notify brand failed:', err.message);
      }
    }

    return {
      id: updated._id,
      status: updated.status,
      displayStatus: DISPLAY_STATUS.AWAITING_ADVERTISER,
      reviewedAt: now,
    };
  }

  // REJECT
  const updated = await Submission.findOneAndUpdate(
    {
      _id: submission._id,
      status: SUBMISSION_STATUS.UNDER_REVIEW,
      'aiReview.status': require('../../constants/campaign.constants').AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
      $or: [
        { 'adminReview.decision': null },
        { 'adminReview.decision': { $exists: false } },
      ],
    },
    {
      $set: {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: REJECTED_BY.ADMIN,
        reviewedAt: now,
        linkLocked: false,
        'adminReview.decision': 'REJECT',
        'adminReview.reviewedAt': now,
        'adminReview.reviewedBy': adminId,
        'adminReview.note': note,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError('Submission is not in manual review', 'SUBMISSION_ALREADY_REVIEWED');
  }

  const campaign = submission.campaignId;
  try {
    await notifyCreatorRejected(
      toNotificationPayload(submission),
      toNotificationCampaign(campaign),
      { note }
    );
  } catch (err) {
    console.error('[submissionReview.service] notify rejected failed:', err.message);
  }

  return {
    id: updated._id,
    status: updated.status,
    displayStatus: DISPLAY_STATUS.REJECTED,
    reviewedAt: now,
  };
};

// ============================================
// 5. autoApproveDueSubmissions — يُستدعى من الـ job
// ============================================
const autoApproveDueSubmissions = async () => {
  if (process.env.ENABLE_SUBMISSION_AUTO_APPROVE === 'false') {
    return { processed: 0, approved: 0 };
  }

  const now = new Date();

  const dueSubmissions = await Submission.find({
    status: SUBMISSION_STATUS.UNDER_REVIEW,
    'advertiserReview.status': ADVERTISER_STATUS.PENDING,
    reviewDeadlineAt: { $lte: now },
    // مرحلة المعلن فقط: التسليم الذي ما زال ينتظر قرار الأدمن لا يُعتمد تلقائيًا (§8)
    $or: [
      { 'aiReview.status': { $ne: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED } },
      { 'adminReview.decision': { $ne: null } },
    ],
  })
    .populate('campaignId', 'name advertiserId')
    .lean();

  let approved = 0;

  for (const s of dueSubmissions) {
    const session = await mongoose.startSession();
    let updated;
    let campaign;
    try {
      await session.withTransaction(async () => {
        updated = undefined;
        campaign = null;
        campaign = await Campaign.findById(s.campaignId?._id || s.campaignId).session(session);
        if (!campaign || campaign.isSuspended === true) return;

        updated = await Submission.findOneAndUpdate(
          {
            _id: s._id,
            status: SUBMISSION_STATUS.UNDER_REVIEW,
            'advertiserReview.status': ADVERTISER_STATUS.PENDING,
            reviewDeadlineAt: { $lte: now },
            // نفس شرط الاستعلام: لا نعتمد ما ينتظر قرار الأدمن
            $or: [
              { 'aiReview.status': { $ne: AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED } },
              { 'adminReview.decision': { $ne: null } },
            ],
          },
          {
            $set: {
              status: SUBMISSION_STATUS.APPROVED,
              reviewedAt: now,
              approvedAt: now,
              'advertiserReview.status': ADVERTISER_STATUS.AUTO_APPROVED,
              'advertiserReview.reviewedAt': now,
            },
          },
          { new: true, session }
        );

        if (updated) {
          await Campaign.updateOne(
            { _id: campaign._id },
            { $inc: { 'stats.totalApprovedVideos': 1 } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (updated) {
      approved += 1;

      try {
        await notifyCreatorApproved(
          { _id: s._id, creatorId: s.creatorId },
          campaign,
          { auto: true }
        );
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
  bulkApproveSubmissions,
  bulkReviewSubmissions,
  getManualReviewQueue,
  decideManualReview,
  autoApproveDueSubmissions,
};
