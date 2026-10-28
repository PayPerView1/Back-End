// src/jobs/submissionAutoApprove.job.js
// المالك: المسار ب — job الاعتماد التلقائي للتسليمات التي تجاوزت reviewDeadlineAt.
// المرجع: API_CONTRACT_Sprint5.md §8
//
// ⚠️ Job idempotent + catch-up pass عند الإقلاع (Render free instance sleeps).

const cron = require('node-cron');
const submissionReviewService = require('../services/submission/submissionReview.service');

let isRunning = false;

/**
 * يشغّل الاعتماد التلقائي مرة واحدة
 */
const runAutoApprove = async () => {
  if (isRunning) {
    console.log('[submissionAutoApprove] skipped — previous run still in progress');
    return;
  }

  if (process.env.ENABLE_SUBMISSION_AUTO_APPROVE === 'false') {
    console.log('[submissionAutoApprove] disabled by env');
    return;
  }

  isRunning = true;
  try {
    const { processed, approved } =
      await submissionReviewService.autoApproveDueSubmissions();

    if (processed > 0) {
      console.log(
        `[submissionAutoApprove] processed=${processed} approved=${approved}`
      );
    }
  } catch (error) {
    console.error('[submissionAutoApprove] error:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * يبدأ الـ job (كل 10 دقائق + مرة عند الإقلاع)
 */
const startSubmissionAutoApprove = () => {
  // Catch-up pass عند الإقلاع (Render free tier sleeps)
  setImmediate(() => {
    runAutoApprove().catch((err) => {
      console.error('[submissionAutoApprove] startup run failed:', err.message);
    });
  });

  // كل 10 دقائق
  cron.schedule('*/10 * * * *', () => {
    runAutoApprove().catch((err) => {
      console.error('[submissionAutoApprove] cron run failed:', err.message);
    });
  });

  console.log('[submissionAutoApprove] Scheduled to run every 10 minutes (cron: "*/10 * * * *")');
};

module.exports = {
  startSubmissionAutoApprove,
  runAutoApprove,
};