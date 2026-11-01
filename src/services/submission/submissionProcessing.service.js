// src/services/submission/submissionProcessing.service.js
// المالك: المسار ب — معالجة التسليمات بالـ AI (B3).
// المرجع: API_CONTRACT_Sprint5.md §8
//
// ⚠️ يستخدم buildReviewPayload و reviewSubmission من aiSubmissionReview.client.js (زميلك).

const Submission = require('../../models/submission');
const {
  SUBMISSION_STATUS,
  REJECTED_BY,
  SUBMISSION_CONFIG,
  CHECK_SOURCE,
} = require('../../constants/submission.constants');
const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');
const {
  buildReviewPayload,
  reviewSubmission,
} = require('../ai/aiSubmissionReview.client');
const {
  notifyCreatorAiApproved,
  notifyCreatorAiRejected,
  notifyCreatorManualReview,
  notifyAdminsManualReview,
  notifyBrandNewSubmission,
} = require('./submissionNotifications.service');

// ============================================
// Helpers
// ============================================
const PROCESSING_LOCK_MINUTES = SUBMISSION_CONFIG.PROCESSING_LOCK_MINUTES || 5;
const AI_MAX_ATTEMPTS = SUBMISSION_CONFIG.AI_MAX_ATTEMPTS || 3;

const toNotificationSubmission = (doc) => {
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
// processSubmission
// ============================================
const processSubmission = async (submissionId) => {
  const lockCutoff = new Date(Date.now() - PROCESSING_LOCK_MINUTES * 60 * 1000);

  // 1. احجز القفل ذرّياً
  const locked = await Submission.findOneAndUpdate(
    {
      _id: submissionId,
      status: SUBMISSION_STATUS.SUBMITTED,
      'aiReview.status': AI_REVIEW_RESULT.PENDING,
      $or: [
        { 'processing.lockedAt': null },
        { 'processing.lockedAt': { $lt: lockCutoff } },
      ],
    },
    {
      $set: { 'processing.lockedAt': new Date() },
      $inc: { 'aiReview.attempts': 1 },
    },
    { new: true }
  ).populate('campaignId');

  if (!locked) {
    console.log(`[submissionProcessing] skip ${submissionId} — locked or already processed`);
    return { skipped: true };
  }

  const campaign = locked.campaignId;
  if (!campaign) {
    await Submission.updateOne(
      { _id: locked._id },
      { $set: { 'processing.lockedAt': null } }
    );
    return { skipped: true, reason: 'NO_CAMPAIGN' };
  }

  const attempt = (locked.aiReview && locked.aiReview.attempts) || 1;

  try {
    // 2. بناء payload + استدعاء AI
    const backendChecks = (locked.checks || [])
      .filter((c) => c.source === CHECK_SOURCE.RULES)
      .map((c) => ({ code: c.code, status: c.status }));

    const payload = buildReviewPayload({
      submission: locked,
      campaign,
      backendChecks,
    });

    const aiResult = await reviewSubmission(payload);

    // 3. طبّق النتيجة
    await applyAiResult(locked, campaign, aiResult);

    return { processed: true, result: aiResult.result };
  } catch (error) {
    console.error(`[submissionProcessing] AI attempt ${attempt} failed:`, error.message);

    const isFinal = attempt >= AI_MAX_ATTEMPTS;

    if (isFinal) {
      // تحويل للمراجعة اليدوية
      await Submission.updateOne(
        {
          _id: locked._id,
          status: SUBMISSION_STATUS.SUBMITTED,
          'aiReview.status': AI_REVIEW_RESULT.PENDING,
        },
        {
          $set: {
            status: SUBMISSION_STATUS.UNDER_REVIEW,
            'aiReview.status': AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
            'aiReview.lastError': String(error.message || 'AI_FAILED').slice(0, 300),
            'aiReview.lastAttemptAt': new Date(),
            'adminReview.reasonCode': 'AI_UNAVAILABLE',
            'adminReview.queuedAt': new Date(),
            'processing.lockedAt': null,
          },
        }
      );

      try {
        await notifyCreatorManualReview(
          toNotificationSubmission(locked),
          toNotificationCampaign(campaign)
        );
        await notifyAdminsManualReview(
          toNotificationSubmission(locked),
          toNotificationCampaign(campaign),
          'AI_UNAVAILABLE'
        );
      } catch (err) {
        console.error('[submissionProcessing] notify failed:', err.message);
      }

      return { processed: false, exhausted: true, attempts: attempt };
    }

    // مازال في محاولات
    await Submission.updateOne(
      { _id: locked._id },
      {
        $set: {
          'aiReview.lastError': String(error.message || 'AI_FAILED').slice(0, 300),
          'aiReview.lastAttemptAt': new Date(),
          'processing.lockedAt': null,
        },
      }
    );

    return { processed: false, failed: true, attempts: attempt };
  }
};

// ============================================
// applyAiResult
// ============================================
const applyAiResult = async (locked, campaign, aiResult) => {
  const aiChecks = (aiResult.checks || []).map((c) => ({
    code: c.code,
    source: CHECK_SOURCE.AI,
    status: c.status,
    message: c.message || '',
    fixHint: c.fixHint || '',
    score: c.score ?? null,
    meta: null,
  }));

  const backendChecks = (locked.checks || []).filter((c) => c.source === CHECK_SOURCE.RULES);
  const allChecks = [...backendChecks, ...aiChecks];

  const now = new Date();

  if (aiResult.result === AI_REVIEW_RESULT.APPROVED) {
    const updated = await Submission.findOneAndUpdate(
      {
        _id: locked._id,
        status: SUBMISSION_STATUS.SUBMITTED,
        'aiReview.status': AI_REVIEW_RESULT.PENDING,
      },
      {
        $set: {
          status: SUBMISSION_STATUS.UNDER_REVIEW,
          'aiReview.status': AI_REVIEW_RESULT.APPROVED,
          'aiReview.score': aiResult.score,
          'aiReview.feedback': aiResult.feedback,
          'aiReview.reviewedAt': now,
          'aiReview.lastError': null,
          checks: allChecks,
          'advertiserReview.status': 'PENDING',
          'processing.lockedAt': null,
        },
      },
      { new: true }
    );

    if (updated) {
      try {
        await notifyCreatorAiApproved(
          toNotificationSubmission(updated),
          toNotificationCampaign(campaign)
        );
        await notifyBrandNewSubmission(
          toNotificationSubmission(updated),
          toNotificationCampaign(campaign)
        );
      } catch (err) {
        console.error('[submissionProcessing] notify approved failed:', err.message);
      }
    }

    return;
  }

  if (aiResult.result === AI_REVIEW_RESULT.REJECTED) {
    const rejectionReasons = (aiResult.checks || [])
      .filter((c) => c.status === 'FAILED')
      .map((c) => ({ code: c.code, message: c.message || '' }));

    if (rejectionReasons.length === 0) {
      rejectionReasons.push({
        code: 'GENERAL',
        message: aiResult.feedback || 'Does not meet requirements',
      });
    }

    const updated = await Submission.findOneAndUpdate(
      {
        _id: locked._id,
        status: SUBMISSION_STATUS.SUBMITTED,
        'aiReview.status': AI_REVIEW_RESULT.PENDING,
      },
      {
        $set: {
          status: SUBMISSION_STATUS.REJECTED,
          rejectedBy: REJECTED_BY.AI,
          'aiReview.status': AI_REVIEW_RESULT.REJECTED,
          'aiReview.score': aiResult.score,
          'aiReview.feedback': aiResult.feedback,
          'aiReview.reviewedAt': now,
          'aiReview.lastError': null,
          checks: allChecks,
          rejectionReasons,
          linkLocked: false,
          'processing.lockedAt': null,
        },
      },
      { new: true }
    );

    if (updated) {
      try {
        await notifyCreatorAiRejected(
          toNotificationSubmission(updated),
          toNotificationCampaign(campaign)
        );
      } catch (err) {
        console.error('[submissionProcessing] notify rejected failed:', err.message);
      }
    }

    return;
  }

  // MANUAL_REVIEW_REQUIRED
  const updated = await Submission.findOneAndUpdate(
    {
      _id: locked._id,
      status: SUBMISSION_STATUS.SUBMITTED,
      'aiReview.status': AI_REVIEW_RESULT.PENDING,
    },
    {
      $set: {
        status: SUBMISSION_STATUS.UNDER_REVIEW,
        'aiReview.status': AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
        'aiReview.score': aiResult.score,
        'aiReview.feedback': aiResult.feedback,
        'aiReview.reviewedAt': now,
        'aiReview.lastError': null,
        checks: allChecks,
        'adminReview.reasonCode': aiResult.manualReasonCode || 'MANUAL',
        'adminReview.queuedAt': now,
        'processing.lockedAt': null,
      },
    },
    { new: true }
  );

  if (updated) {
    try {
      await notifyCreatorManualReview(
        toNotificationSubmission(updated),
        toNotificationCampaign(campaign)
      );
      await notifyAdminsManualReview(
        toNotificationSubmission(updated),
        toNotificationCampaign(campaign),
        aiResult.manualReasonCode || 'MANUAL'
      );
    } catch (err) {
      console.error('[submissionProcessing] notify manual failed:', err.message);
    }
  }
};

// ============================================
// recoverPendingSubmissions
// ============================================
const recoverPendingSubmissions = async (limit = 20) => {
  const lockCutoff = new Date(Date.now() - PROCESSING_LOCK_MINUTES * 60 * 1000);

  const pending = await Submission.find({
    status: SUBMISSION_STATUS.SUBMITTED,
    'aiReview.status': AI_REVIEW_RESULT.PENDING,
    $or: [
      { 'processing.lockedAt': null },
      { 'processing.lockedAt': { $lt: lockCutoff } },
    ],
  })
    .limit(limit)
    .select('_id')
    .lean();

  const results = [];
  for (const s of pending) {
    try {
      const r = await processSubmission(s._id);
      results.push({ id: s._id, ...r });
    } catch (err) {
      console.error(`[submissionProcessing] recover ${s._id} error:`, err.message);
      results.push({ id: s._id, error: err.message });
    }
  }

  return results;
};

module.exports = {
  processSubmission,
  recoverPendingSubmissions,
};