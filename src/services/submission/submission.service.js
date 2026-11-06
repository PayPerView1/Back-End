// src/services/submission/submission.service.js
// المالك: المسار ب — منطق دورة التسليم (create, read, withdraw, updateLink, resubmit).
// المرجع: API_CONTRACT_Sprint5.md §5

const mongoose = require('mongoose');
const Submission = require('../../models/submission');
const Campaign = require('../../models/campaign');
const Application = require('../../models/application');
const { AppError } = require('../../utils/errors');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const {
  SUBMISSION_STATUS,
  ADVERTISER_STATUS,
  CHECK_SOURCE,
  LINK_HOLDING_STATUSES,
  SUBMISSION_CONFIG,
  getDisplayStatus,
  DISPLAY_STATUS,
} = require('../../constants/submission.constants');
const { toDetail, toListItem } = require('../../utils/submission/submissionDto.utils');
const { toStoredList, extractHashtags } = require('../../utils/submission/hashtag.utils');
const { evaluateRequirements } = require('../../utils/submission/submissionRules.utils');
const {
  getAcceptedApplication,
  assertCampaignOpenForSubmissions,
  assertWithinSubmissionLimit,
} = require('../../utils/submission/submissionGuards.utils');
const { deleteDraft } = require('./submissionDraft.service');

// ⚠️ verifyPost — من T1 (المسار أ). استيراد مؤقت.
let verifyPost;
try {
  ({ verifyPost } = require('./submissionVerify.service'));
} catch (err) {
  // stub مؤقت لحد ما يجهز A0
  verifyPost = async () => {
    throw new AppError('verifyPost not implemented yet', 'NOT_IMPLEMENTED');
  };
}

// ============================================
// Helpers
// ============================================

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** يحوّل displayStatus → MongoDB filter */
const displayStatusToFilter = (displayStatus) => {
  const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');

  switch (displayStatus) {
    case DISPLAY_STATUS.PROCESSING:
      return { status: SUBMISSION_STATUS.SUBMITTED };
    case DISPLAY_STATUS.AI_REJECTED:
      return {
        status: SUBMISSION_STATUS.REJECTED,
        rejectedBy: { $in: ['AI', 'RULES'] },
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
        // المراجعة اليدوية حالة منفصلة: لا تُحتسب ضمن "بانتظار المعلن"
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
        rejectedBy: { $in: ['ADVERTISER', 'ADMIN'] },
      };
    case DISPLAY_STATUS.WITHDRAWN:
      return { status: SUBMISSION_STATUS.WITHDRAWN };
    default:
      return {};
  }
};

// ============================================
// 1. B1 — createSubmission
// ============================================
/**
 * POST /campaigns/:campaignId/submissions
 * @param {string} creatorId
 * @param {string} campaignId
 * @param {{ platform, url, hashtags?, keywords?, notes?, halalPledge }} body
 */
const createSubmission = async (creatorId, campaignId, body) => {
  if (!isValidId(campaignId)) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // 1. verifyPost (T1) — يتحقق من: application مقبول، حملة مفتوحة، حد التسليمات، المنصة، الرابط، بيانات المنشور
  const { campaign, application, parsed, postMeta, evaluation } = await verifyPost({
    creatorId,
    campaignId,
    platform: body.platform,
    url: body.url,
  });

  // 2. فحص canSubmit — نرمي CONTENT_REQUIREMENTS_NOT_MET
  if (!evaluation.canSubmit) {
    throw new AppError(
      'Content does not meet campaign requirements',
      'CONTENT_REQUIREMENTS_NOT_MET',
      undefined,
      evaluation.blocking
    );
  }

  // 3. حساب deadline
  const deadlineHours =
    SUBMISSION_CONFIG.REVIEW_DEADLINE_HOURS ||
    (parseInt(process.env.SUBMISSION_REVIEW_DEADLINE_HOURS, 10) || 24);
  const reviewDeadlineAt = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

  // 4. hashtags — من المبدع أو من caption
  const suppliedHashtags = toStoredList(body.hashtags || [], { max: 30, maxLength: 100 });
  const captionHashtags =
    postMeta && postMeta.fetchStatus === 'OK'
      ? extractHashtags(postMeta.caption || '').map((h) => h.replace(/^#/, ''))
      : [];
  const mergedHashtags = toStoredList(
    [...suppliedHashtags, ...captionHashtags],
    { max: 30, maxLength: 100 }
  );

  const keywords = toStoredList(body.keywords || [], { max: 30, maxLength: 100 });
  const notes = (body.notes || '').slice(0, SUBMISSION_CONFIG.NOTES_MAX_LENGTH || 500);

  // 5. بناء المستند
  const submissionPayload = {
    campaignId: campaign._id,
    creatorId,
    applicationId: application._id,
    platform: parsed.platform || body.platform,
    postUrl: body.url,
    canonicalUrl: parsed.canonicalUrl || '',
    externalId: parsed.externalId || '',
    dedupKey: parsed.externalId ? `${parsed.platform || body.platform}:${parsed.externalId}` : null,
    linkLocked: true,
    hashtags: mergedHashtags,
    keywords,
    notes,
    halalPledge: {
      accepted: true,
      acceptedAt: new Date(),
    },
    postMeta: {
      fetchStatus: postMeta?.fetchStatus || 'UNAVAILABLE',
      caption: postMeta?.caption || '',
      authorName: postMeta?.authorName || '',
      authorHandle: postMeta?.authorHandle || '',
      authorUrl: postMeta?.authorUrl || '',
      thumbnailUrl: postMeta?.thumbnailUrl || '',
      durationSec: postMeta?.durationSec ?? null,
      publishedAt: postMeta?.publishedAt || null,
      stats: postMeta?.stats || null,
      fetchedAt: postMeta?.fetchedAt || new Date(),
    },
    checks: evaluation.checks || [],
    status: SUBMISSION_STATUS.SUBMITTED,
    attempt: 1,
    submittedAt: new Date(),
    reviewDeadlineAt,
  };

  let created;
  try {
    // ⚠️ الفهرس الفريد على dedupKey يمنع السباق
    created = await Submission.create(submissionPayload);
  } catch (err) {
    if (err && err.code === 11000) {
      // سباق: نفس الرابط تسلّم في نفس اللحظة
      throw new AppError('This link has already been submitted', 'LINK_ALREADY_SUBMITTED');
    }
    throw err;
  }

  // 6. سباق حد التسليمات — نعيد العدّ
  const activeCount = await Submission.countDocuments({
    creatorId,
    campaignId: campaign._id,
    status: { $in: LINK_HOLDING_STATUSES },
  });
  const limit =
    campaign.maxSubmissionsPerCreator ||
    SUBMISSION_CONFIG.MAX_ACTIVE_PER_CREATOR_PER_CAMPAIGN ||
    5;

  if (activeCount > limit) {
    // حذف المستند الذي تجاوز الحد
    await Submission.deleteOne({ _id: created._id });
    throw new AppError(
      'You reached the maximum number of active submissions for this campaign.',
      'SUBMISSION_LIMIT_REACHED'
    );
  }

  // 7. حذف المسودة (T2)
  try {
    await deleteDraft(creatorId, campaignId);
  } catch (err) {
    console.error('[submission.service] deleteDraft failed:', err.message);
  }

  // 8. إشعار المعلن: لا يُرسل الآن — العقد §7 يرسل NEW_SUBMISSION عند وصول
  //    التسليم لمرحلة المعلن فقط (بعد موافقة AI أو الأدمن)، وليس عند الإنشاء.

  // 9. تشغيل المعالجة (B3 — setImmediate، مش await)
  setImmediate(() => {
    try {
      // eslint-disable-next-line global-require
      const { processSubmission } = require('./submissionProcessing.service');
      if (typeof processSubmission === 'function') {
        processSubmission(created._id).catch((err) => {
          console.error('[submission.service] processSubmission failed:', err.message);
        });
      }
    } catch (err) {
      console.error('[submission.service] processSubmission require failed:', err.message);
    }
  });

  // 10. response
  return toDetail(created.toObject(), { campaign });
};

// ============================================
// 2. B2 — getMySubmissions
// ============================================
const getMySubmissions = async (creatorId, filters = {}) => {
  const { page, perPage, skip } = parsePagination(filters, {
    defaultPerPage: 20,
    maxPerPage: 50,
  });

  const query = { creatorId };

  if (filters.campaignId) {
    if (!isValidId(filters.campaignId)) {
      throw new AppError('Invalid campaign id', 'VALIDATION_ERROR');
    }
    query.campaignId = filters.campaignId;
  }

  if (filters.displayStatus) {
    Object.assign(query, displayStatusToFilter(filters.displayStatus));
  } else {
    // الافتراضي: استثناء WITHDRAWN
    query.status = { $ne: SUBMISSION_STATUS.WITHDRAWN };
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
      .lean(),
    Submission.countDocuments(query),
  ]);

  const data = submissions.map((s) => toListItem(s, { campaign: s.campaignId }));

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 3. B2 — getSubmissionById
// ============================================
const getSubmissionById = async (submissionId, creatorId) => {
  if (!isValidId(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const submission = await Submission.findOne({
    _id: submissionId,
    creatorId,
  })
    .populate({
      path: 'campaignId',
      select: 'name advertiserId',
      populate: { path: 'advertiserId', select: 'fullName profilePicture' },
    })
    .lean();

  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  return toDetail(submission, { campaign: submission.campaignId });
};

// ============================================
// 4. B4 — withdrawSubmission
// ============================================
const withdrawSubmission = async (submissionId, creatorId) => {
  if (!isValidId(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const submission = await Submission.findOne({
    _id: submissionId,
    creatorId,
  });

  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  // يمكن السحب إذا:
  //  - status = SUBMITTED (PROCESSING)
  //  - OR status = UNDER_REVIEW + advertiserReview.status = PENDING (قبل قرار المعلن)
  //    وهذا يشمل MANUAL_REVIEW: المعلن لم يقرر بعد (العقد §5: canWithdraw)
  const displayStatus = getDisplayStatus(submission);
  const canWithdraw = [
    DISPLAY_STATUS.PROCESSING,
    DISPLAY_STATUS.MANUAL_REVIEW,
    DISPLAY_STATUS.AWAITING_ADVERTISER,
  ].includes(displayStatus);

  if (!canWithdraw) {
    throw new AppError('Submission cannot be withdrawn', 'SUBMISSION_NOT_WITHDRAWABLE');
  }

  const now = new Date();
  const updated = await Submission.findOneAndUpdate(
    {
      _id: submission._id,
      creatorId,
      $or: [
        { status: SUBMISSION_STATUS.SUBMITTED },
        {
          status: SUBMISSION_STATUS.UNDER_REVIEW,
          'advertiserReview.status': ADVERTISER_STATUS.PENDING,
        },
      ],
    },
    {
      $set: {
        status: SUBMISSION_STATUS.WITHDRAWN,
        linkLocked: false,
        withdrawnAt: now,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError('Submission cannot be withdrawn', 'SUBMISSION_NOT_WITHDRAWABLE');
  }

  return {
    id: updated._id,
    status: updated.status,
  };
};

// ============================================
// 5. B4 — updateSubmissionLink
// ============================================
const updateSubmissionLink = async (submissionId, creatorId, { url, reason }) => {
  if (!isValidId(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const submission = await Submission.findOne({
    _id: submissionId,
    creatorId,
  }).populate('campaignId');

  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const displayStatus = getDisplayStatus(submission);
  if (
    ![DISPLAY_STATUS.AWAITING_ADVERTISER, DISPLAY_STATUS.APPROVED].includes(displayStatus)
  ) {
    throw new AppError('Submission link cannot be updated now', 'SUBMISSION_NOT_EDITABLE');
  }

  const campaign = submission.campaignId;
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // إعادة التحقق من الرابط
  const { parsed, postMeta, evaluation } = await verifyPost({
    creatorId,
    campaignId: campaign._id,
    platform: submission.platform,
    url,
    excludeSubmissionId: submission._id,
    skipLimitCheck: true,
  });

  if (!evaluation.canSubmit) {
    throw new AppError(
      'Content does not meet campaign requirements',
      'CONTENT_REQUIREMENTS_NOT_MET',
      undefined,
      evaluation.blocking
    );
  }

  const now = new Date();
  const oldUrl = submission.postUrl;

  // append link history
  const newHistoryEntry = {
    postUrl: oldUrl,
    canonicalUrl: submission.canonicalUrl || '',
    changedAt: now,
    reason: (reason || '').slice(0, 200),
  };

  // status يعود لـ SUBMITTED (لأن AI رح يعيد الفحص)
  const update = {
    $set: {
      postUrl: url,
      canonicalUrl: parsed.canonicalUrl || '',
      externalId: parsed.externalId || '',
      dedupKey: parsed.externalId
        ? `${parsed.platform || submission.platform}:${parsed.externalId}`
        : null,
      linkLocked: true,
      postMeta: {
        fetchStatus: postMeta?.fetchStatus || 'UNAVAILABLE',
        caption: postMeta?.caption || '',
        authorName: postMeta?.authorName || '',
        authorHandle: postMeta?.authorHandle || '',
        authorUrl: postMeta?.authorUrl || '',
        thumbnailUrl: postMeta?.thumbnailUrl || '',
        durationSec: postMeta?.durationSec ?? null,
        publishedAt: postMeta?.publishedAt || null,
        stats: postMeta?.stats || null,
        fetchedAt: postMeta?.fetchedAt || new Date(),
      },
      checks: evaluation.checks || [],
      status: SUBMISSION_STATUS.SUBMITTED,
      rejectedBy: null,
      rejectionReasons: [],
      reviewedAt: null,
      approvedAt: null,
      'advertiserReview.status': ADVERTISER_STATUS.PENDING,
      'advertiserReview.reviewedBy': null,
      'advertiserReview.reviewedAt': null,
      'advertiserReview.note': '',
      'aiReview.status': 'PENDING',
      'aiReview.score': null,
      'aiReview.feedback': null,
      'aiReview.reviewedAt': null,
      // إعادة ضبط قرار الأدمن: التسليم رجع لدورة فحص جديدة
      'adminReview.decision': null,
      'adminReview.reasonCode': null,
      'adminReview.queuedAt': null,
      'adminReview.reviewedBy': null,
      'adminReview.reviewedAt': null,
      'adminReview.note': '',
      reviewDeadlineAt: new Date(
        now.getTime() +
          (SUBMISSION_CONFIG.REVIEW_DEADLINE_HOURS || 24) * 60 * 60 * 1000
      ),
    },
    $push: { linkHistory: newHistoryEntry },
  };

  const updated = await Submission.findOneAndUpdate(
    {
      _id: submission._id,
      creatorId,
    },
    update,
    { new: true }
  );

  if (!updated) {
    throw new AppError('Submission link cannot be updated now', 'SUBMISSION_NOT_EDITABLE');
  }

  // إعادة تشغيل المعالجة (B3)
  setImmediate(() => {
    try {
      const { processSubmission } = require('./submissionProcessing.service');
      if (typeof processSubmission === 'function') {
        processSubmission(updated._id).catch((err) => {
          console.error('[submission.service] processSubmission failed:', err.message);
        });
      }
    } catch (err) {
      console.error('[submission.service] processSubmission require failed:', err.message);
    }
  });

  return toDetail(updated.toObject(), { campaign });
};

// ============================================
// 6. B4 — resubmitSubmission
// ============================================
const resubmitSubmission = async (submissionId, creatorId, body = {}) => {
  if (!isValidId(submissionId)) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const original = await Submission.findOne({
    _id: submissionId,
    creatorId,
  }).populate('campaignId');

  if (!original) {
    throw new AppError('Submission not found', 'NOT_FOUND');
  }

  const displayStatus = getDisplayStatus(original);
  if (![DISPLAY_STATUS.AI_REJECTED, DISPLAY_STATUS.REJECTED].includes(displayStatus)) {
    throw new AppError('Submission is not in a rejected state', 'SUBMISSION_NOT_EDITABLE');
  }

  const campaign = original.campaignId;
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  const newUrl = body.url || original.postUrl;
  const newPlatform = body.platform || original.platform;

  // verifyPost
  const { parsed, postMeta, evaluation } = await verifyPost({
    creatorId,
    campaignId: campaign._id,
    platform: newPlatform,
    url: newUrl,
    excludeSubmissionId: original._id,
  });

  if (!evaluation.canSubmit) {
    throw new AppError(
      'Content does not meet campaign requirements',
      'CONTENT_REQUIREMENTS_NOT_MET',
      undefined,
      evaluation.blocking
    );
  }

  const deadlineHours =
    SUBMISSION_CONFIG.REVIEW_DEADLINE_HOURS ||
    (parseInt(process.env.SUBMISSION_REVIEW_DEADLINE_HOURS, 10) || 24);
  const reviewDeadlineAt = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

  // hashtags
  const suppliedHashtags = body.hashtags
    ? toStoredList(body.hashtags, { max: 30, maxLength: 100 })
    : original.hashtags || [];
  const captionHashtags =
    postMeta && postMeta.fetchStatus === 'OK'
      ? extractHashtags(postMeta.caption || '').map((h) => h.replace(/^#/, ''))
      : [];
  const mergedHashtags = toStoredList(
    [...suppliedHashtags, ...captionHashtags],
    { max: 30, maxLength: 100 }
  );

  const keywords =
    body.keywords !== undefined
      ? toStoredList(body.keywords, { max: 30, maxLength: 100 })
      : original.keywords || [];
  const notes =
    body.notes !== undefined
      ? (body.notes || '').slice(0, SUBMISSION_CONFIG.NOTES_MAX_LENGTH || 500)
      : original.notes || '';

  const newPayload = {
    campaignId: campaign._id,
    creatorId,
    applicationId: original.applicationId,
    platform: parsed.platform || newPlatform,
    postUrl: newUrl,
    canonicalUrl: parsed.canonicalUrl || '',
    externalId: parsed.externalId || '',
    dedupKey: parsed.externalId
      ? `${parsed.platform || newPlatform}:${parsed.externalId}`
      : null,
    linkLocked: true,
    hashtags: mergedHashtags,
    keywords,
    notes,
    halalPledge: {
      accepted: true,
      acceptedAt: new Date(),
    },
    postMeta: {
      fetchStatus: postMeta?.fetchStatus || 'UNAVAILABLE',
      caption: postMeta?.caption || '',
      authorName: postMeta?.authorName || '',
      authorHandle: postMeta?.authorHandle || '',
      authorUrl: postMeta?.authorUrl || '',
      thumbnailUrl: postMeta?.thumbnailUrl || '',
      durationSec: postMeta?.durationSec ?? null,
      publishedAt: postMeta?.publishedAt || null,
      stats: postMeta?.stats || null,
      fetchedAt: postMeta?.fetchedAt || new Date(),
    },
    checks: evaluation.checks || [],
    status: SUBMISSION_STATUS.SUBMITTED,
    attempt: (original.attempt || 1) + 1,
    resubmissionOf: original._id,
    submittedAt: new Date(),
    reviewDeadlineAt,
  };

  let created;
  try {
    created = await Submission.create(newPayload);
  } catch (err) {
    if (err && err.code === 11000) {
      throw new AppError('This link has already been submitted', 'LINK_ALREADY_SUBMITTED');
    }
    throw err;
  }

  // إشعار المعلن: لا يُرسل الآن — العقد §7 يرسل NEW_SUBMISSION عند وصول
  // التسليم لمرحلة المعلن فقط (بعد موافقة AI أو الأدمن).

  // تشغيل المعالجة
  setImmediate(() => {
    try {
      const { processSubmission } = require('./submissionProcessing.service');
      if (typeof processSubmission === 'function') {
        processSubmission(created._id).catch((err) => {
          console.error('[submission.service] processSubmission failed:', err.message);
        });
      }
    } catch (err) {
      console.error('[submission.service] processSubmission require failed:', err.message);
    }
  });

  return toDetail(created.toObject(), { campaign });
};

module.exports = {
  createSubmission,
  getMySubmissions,
  getSubmissionById,
  withdrawSubmission,
  updateSubmissionLink,
  resubmitSubmission,
};