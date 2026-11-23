const cron = require('node-cron');
const submissionViewsService = require('../services/submission/submissionViews.service');

let isRunning = false;

const runViewTracking = async () => {
  if (isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
  isRunning = true;
  try {
    return await submissionViewsService.runViewTracking();
  } catch (error) {
    console.error('[submissionViews] tracking run failed:', error.message);
    return { error: true };
  } finally {
    isRunning = false;
  }
};

const startSubmissionViews = () => {
  setImmediate(() => runViewTracking());
  const interval = submissionViewsService.POLL_INTERVAL_MINUTES;
  const schedule = interval >= 60 ? '0 * * * *' : `*/${interval} * * * *`;
  cron.schedule(schedule, () => runViewTracking());
  console.log(`[submissionViews] scheduled with cron ${schedule}`);
};

module.exports = { runViewTracking, startSubmissionViews };
