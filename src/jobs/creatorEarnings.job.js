const cron = require('node-cron');
const creatorEarningsService = require('../services/wallet/creatorEarnings.service');

let isRunning = false;

const runCreatorEarningsRelease = async () => {
  if (isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
  isRunning = true;
  try {
    return await creatorEarningsService.releaseDueEarnings();
  } catch (error) {
    console.error('[creatorEarnings] release job failed:', error.message);
    return { error: true };
  } finally {
    isRunning = false;
  }
};

const startCreatorEarningsRelease = () => {
  setImmediate(() => runCreatorEarningsRelease());
  cron.schedule('*/5 * * * *', () => runCreatorEarningsRelease());
  console.log('[creatorEarnings] pending earnings release scheduled every 5 minutes');
};

module.exports = { runCreatorEarningsRelease, startCreatorEarningsRelease };
