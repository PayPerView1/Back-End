// src/jobs/submissionProcessor.job.js
// المالك: المسار ب — Job معالجة التسليمات بالـ AI (B3).
// المرجع: API_CONTRACT_Sprint5.md §8
//
// ⚠️ Job idempotent + catch-up pass عند الإقلاع (Render free instance sleeps).

const cron = require('node-cron');
const submissionProcessingService = require('../services/submission/submissionProcessing.service');

let isRunning = false;

/**
 * يشغّل المعالجة مرة واحدة
 */
const runSubmissionProcessor = async () => {
  if (isRunning) {
    console.log('[submissionProcessor] skipped — previous run still in progress');
    return;
  }

  isRunning = true;
  try {
    const results = await submissionProcessingService.recoverPendingSubmissions(20);

    const processed = results.filter((r) => r.processed).length;
    const failed = results.filter((r) => r.failed || r.error).length;
    const exhausted = results.filter((r) => r.exhausted).length;

    if (results.length > 0) {
      console.log(
        `[submissionProcessor] total=${results.length} processed=${processed} failed=${failed} exhausted=${exhausted}`
      );
    }
  } catch (error) {
    console.error('[submissionProcessor] error:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * يبدأ الـ job (كل 2 دقيقة + مرة عند الإقلاع)
 */
const startSubmissionProcessor = () => {
  // Catch-up pass عند الإقلاع
  setImmediate(() => {
    runSubmissionProcessor().catch((err) => {
      console.error('[submissionProcessor] startup run failed:', err.message);
    });
  });

  // كل 2 دقيقة
  cron.schedule('*/2 * * * *', () => {
    runSubmissionProcessor().catch((err) => {
      console.error('[submissionProcessor] cron run failed:', err.message);
    });
  });

  console.log('[submissionProcessor] Scheduled to run every 2 minutes (cron: "*/2 * * * *")');
};

module.exports = {
  startSubmissionProcessor,
  runSubmissionProcessor,
};