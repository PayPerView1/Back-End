// src/jobs/dormantWallet.job.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const Wallet = require('../models/wallet');
const { sendDormantWalletEmail } = require('../services/emailService');

// ----------------------
// منطق الفحص — مستقل عن الـ cron لتسهيل الاختبار
// ----------------------
const runDormantWalletCheck = async () => {
  console.log('[dormantWallet] Running dormant wallet check...');

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // محافظ لم تُحدَّث منذ 6 أشهر ورصيدها > 0
  const dormantWallets = await Wallet.find({
    balance:   { $gt: 0 },
    updatedAt: { $lt: sixMonthsAgo },
  }).populate('advertiserId', 'fullName email');

  if (dormantWallets.length === 0) {
    console.log('[dormantWallet] No dormant wallets found.');
    return;
  }

  console.log(`[dormantWallet] Found ${dormantWallets.length} dormant wallet(s).`);

  for (const wallet of dormantWallets) {
    try {
      if (!wallet.advertiserId?.email) continue;

      await sendDormantWalletEmail(wallet.advertiserId, {
        balance: wallet.balance,
      });

      console.log(
        `[dormantWallet] Reminder sent to: ${wallet.advertiserId.email} | Balance: $${wallet.balance}`
      );
    } catch (error) {
      console.error(
        `[dormantWallet] Failed for wallet ${wallet._id}: ${error.message}`
      );
    }
  }

  console.log('[dormantWallet] Dormant wallet check completed.');
};

// ----------------------
// تسجيل الـ Cron Job
// ----------------------
const startDormantWalletJob = () => {
  // كل أحد منتصف الليل UTC
  cron.schedule('0 0 * * 0', async () => {
    try {
      await runDormantWalletCheck();
    } catch (error) {
      console.error('[dormantWallet] Unexpected error:', error.message);
    }
  });

  console.log('[dormantWallet] Dormant wallet job scheduled (every Sunday 00:00 UTC).');
};

module.exports = { startDormantWalletJob, runDormantWalletCheck };