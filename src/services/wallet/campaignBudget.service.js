// src/services/wallet/campaignBudget.service.js

const mongoose = require('mongoose');
const Campaign = require('../../models/campaign');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const CampaignActivityLog = require('../../models/CampaignActivityLog');
const {
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  PAYMENT_METHOD,
} = require('../../constants/payment.constants');
const {
  CAMPAIGN_STATUS,
  PAUSE_REASON,
  CAMPAIGN_ACTION,
} = require('../../constants/campaign.constants');
const { isCampaignSuspended } = require('../../utils/campaign/campaignStatus.utils');
const { sendBudgetExhaustedEmail } = require('../emailService');
const { notifyFavoritersCampaignUnavailable } = require('../creator/favoriteNotifications.service');
// ----------------------
// Helper: جلب المحفظة والتحقق من الرصيد
// ----------------------
const getWalletAndVerifyBalance = async (advertiserId, amount, session) => {
  const wallet = await Wallet.findOne({ advertiserId }).session(session);

  if (!wallet) {
    const error = new Error('Wallet not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (wallet.balance < amount) {
    const error = new Error('Insufficient wallet balance');
    error.code = 'INSUFFICIENT_BALANCE';
    throw error;
  }

  return wallet;
};

// ----------------------
// [Sprint 4] Helper: الحملة الملغاة (بقرار إشراف) لا تقبل أي عملية ميزانية
// ----------------------
const assertCampaignNotCancelled = (campaign) => {
  if (campaign.status === CAMPAIGN_STATUS.CANCELLED) {
    const error = new Error('This campaign has been cancelled and can no longer be modified');
    error.code = 'CAMPAIGN_UNAVAILABLE';
    throw error;
  }
};

// ----------------------
// 1. تخصيص أو تحديث ميزانية الحملة
// ----------------------
const allocateBudget = async (campaignId, advertiserId, amount) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const campaign = await Campaign.findById(campaignId).session(session);

    if (!campaign) {
      const error = new Error('Campaign not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    // [Sprint 4]
    assertCampaignNotCancelled(campaign);

    // [Funding fix] حملة بلا walletId = لم يُخصم لها شيء من المحفظة بعد.
    // totalBudget الذي ضُبط عند الإنشاء مجرد "ميزانية مطلوبة" وليس مموّلاً،
    // لذلك نعتبر الميزانية السابقة صفراً ونخصم المبلغ كاملاً من المحفظة.
    const isFunded = !!campaign.walletId;
    const previousBudget = isFunded ? campaign.totalBudget || 0 : 0;
    const difference = amount - previousBudget;

    // لا نسمح بتخفيض الميزانية تحت ما أُنفق فعلاً
    if (amount < (campaign.budgetSpent || 0)) {
      const error = new Error('Budget cannot be lower than the amount already spent');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // الرصيد المطلوب هو الفرق فقط (وليس المبلغ كاملاً)
    const wallet = await getWalletAndVerifyBalance(
      advertiserId,
      Math.max(difference, 0),
      session
    );

    // إذا كانت الميزانية الجديدة أقل من السابقة → نعيد الفرق للمحفظة
    // إذا كانت أكبر → نخصم الفرق من المحفظة
    if (difference > 0) {
      // (فحص الرصيد للفرق تم أعلاه عبر getWalletAndVerifyBalance)
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: -difference } },
        { session }
      );
    } else if (difference < 0) {
      // إعادة الفرق للمحفظة
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: Math.abs(difference) } },
        { session }
      );
    }

    // تحديث ميزانية الحملة
    await Campaign.findByIdAndUpdate(
      campaignId,
      {
        totalBudget: amount,
        remainingBudget: isFunded ? campaign.remainingBudget + difference : amount,
        walletId: wallet._id,
      },
      { session }
    );

    // تسجيل DEBIT transaction فقط إذا كان هناك خصم فعلي
    let transactionId = null;
    if (difference !== 0) {
      const transaction = await Transaction.create(
        [
          {
            walletId: wallet._id,
            type: TRANSACTION_TYPE.DEBIT,
            grossAmount: Math.abs(difference),
            commission: 0,
            netAmount: Math.abs(difference),
            currency: 'USD',
            paymentMethod: null,
            status: TRANSACTION_STATUS.COMPLETED,
            description: `Budget ${difference > 0 ? 'allocated to' : 'returned from'} campaign: ${campaign.name}`,
            campaignId,
          },
        ],
        { session }
      );
      transactionId = transaction[0]._id;
    }

    await session.commitTransaction();

    const updatedWallet = await Wallet.findById(wallet._id);
    const updatedCampaign = await Campaign.findById(campaignId);

    return {
      campaignId,
      totalBudget: updatedCampaign.totalBudget,
      remainingBudget: updatedCampaign.remainingBudget,
      budgetSpent: updatedCampaign.budgetSpent,
      walletBalanceAfter: updatedWallet.balance,
      transactionId,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ----------------------
// 2. تعيين أو تحديث الحد اليومي
// ----------------------
const setDailyBudgetLimit = async (campaignId, advertiserId, limit) => {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  // null يعني إزالة الحد اليومي
  if (limit !== null && limit > campaign.totalBudget) {
    const error = new Error('Daily limit cannot exceed total campaign budget');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    dailyBudgetLimit: limit,
    dailyBudgetSpent: 0,
  });

  return {
    campaignId,
    dailyBudgetLimit: limit,
    dailyBudgetSpent: 0,
    message: limit
      ? 'Daily budget limit set successfully'
      : 'Daily budget limit removed',
  };
};

// ----------------------
// 3. إعادة شحن ميزانية الحملة
// ----------------------
const rechargeCampaign = async (campaignId, advertiserId, amount) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const campaign = await Campaign.findById(campaignId).session(session);

    if (!campaign) {
      const error = new Error('Campaign not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    // [Sprint 4] الشحن على حملة موقوفة بسبب بلاغ مسموح، على ملغاة ممنوع
    assertCampaignNotCancelled(campaign);

    // [Funding fix] لا شحن لحملة لم تُموَّل بعد: ميزانيتها الأولى لم تُخصم من المحفظة،
    // والشحن عليها كان سيُبقي المبلغ الأولي "وهمياً". يجب استدعاء allocateBudget أولاً.
    if (!campaign.walletId) {
      const error = new Error(
        'Allocate a budget to this campaign first, then you can recharge it'
      );
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const wallet = await getWalletAndVerifyBalance(advertiserId, amount, session);

    // خصم من المحفظة + إضافة للحملة
    await Wallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: -amount } },
      { session }
    );

    // تحديد ما إذا كانت الحملة ستستأنف تلقائياً
    const wasExhausted = campaign.pauseReason === PAUSE_REASON.BUDGET_EXHAUSTED;
    const shouldAutoResume = campaign.autoResumeOnRecharge && wasExhausted;

    await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $inc: {
          totalBudget: amount,
          remainingBudget: amount,
        },
        lastRechargedAt: new Date(),
        ...(shouldAutoResume && {
          status: CAMPAIGN_STATUS.ACTIVE,
          pauseReason: null,
        }),
      },
      { session }
    );

    // تسجيل الـ transaction
    const transaction = await Transaction.create(
      [
        {
          walletId: wallet._id,
          type: TRANSACTION_TYPE.DEBIT,
          grossAmount: amount,
          commission: 0,
          netAmount: amount,
          currency: 'USD',
          paymentMethod: null,
          status: TRANSACTION_STATUS.COMPLETED,
          description: `Campaign recharged: ${campaign.name}`,
          campaignId,
        },
      ],
      { session }
    );

    // تسجيل في ActivityLog
    await CampaignActivityLog.create(
      [
        {
          campaignId,
          action: CAMPAIGN_ACTION.BUDGET_RECHARGED,
          performedBy: advertiserId,
          metadata: { amount, autoResumed: shouldAutoResume },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const updatedWallet = await Wallet.findById(wallet._id);
    const updatedCampaign = await Campaign.findById(campaignId);

    return {
      campaignId,
      amountAdded: amount,
      totalBudget: updatedCampaign.totalBudget,
      remainingBudget: updatedCampaign.remainingBudget,
      walletBalanceAfter: updatedWallet.balance,
      campaignStatus: updatedCampaign.status,
      autoResumed: shouldAutoResume,
      message: shouldAutoResume
        ? 'Campaign recharged and resumed automatically.'
        : 'Campaign recharged successfully. Resume the campaign manually when ready.',
      transactionId: transaction[0]._id,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ----------------------
// 4. إيقاف الحملة يدوياً
// ----------------------
const pauseCampaign = async (campaignId, advertiserId) => {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (
    campaign.status === CAMPAIGN_STATUS.PAUSED ||
    campaign.status === CAMPAIGN_STATUS.MANUALLY_PAUSED
  ) {
    const error = new Error('Campaign is already paused');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // [Sprint 4] الإيقاف اليدوي مسموح فقط للحملات النشطة
  // (كان ممكناً إيقاف حملة CANCELLED أو COMPLETED ثم استئنافها لتصبح ACTIVE)
  if (campaign.status !== CAMPAIGN_STATUS.ACTIVE) {
    const error = new Error('Only active campaigns can be paused');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    status: CAMPAIGN_STATUS.MANUALLY_PAUSED,
    pauseReason: PAUSE_REASON.MANUAL,
  });

  await CampaignActivityLog.create({
    campaignId,
    action: CAMPAIGN_ACTION.MANUALLY_PAUSED,
    performedBy: advertiserId,
  });
  // Notify favoriters
  try {
  await notifyFavoritersCampaignUnavailable(campaignId, campaign.name, 'NOT_AVAILABLE');
  } catch (error) {
  console.error(`[campaignBudget.service] Failed to notify favoriters: ${error.message}`);
  }

  return {
    campaignId,
    status: CAMPAIGN_STATUS.MANUALLY_PAUSED,
    pauseReason: PAUSE_REASON.MANUAL,
    remainingBudget: campaign.remainingBudget,
  };
};

// ----------------------
// 5. استئناف الحملة يدوياً
// ----------------------
const resumeCampaign = async (campaignId, advertiserId) => {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  // [Sprint 4] ملغاة → لا استئناف. موقوفة بسبب بلاغ → لا استئناف حتى قرار المراجعة
  assertCampaignNotCancelled(campaign);

  if (isCampaignSuspended(campaign)) {
    const error = new Error(
      'This campaign is under review after a report and cannot be resumed yet'
    );
    error.code = 'CAMPAIGN_SUSPENDED';
    throw error;
  }

  if (campaign.remainingBudget <= 0) {
    const error = new Error(
      'Cannot resume campaign with zero budget. Please recharge first.'
    );
    error.code = 'INSUFFICIENT_BALANCE';
    throw error;
  }

  if (
    campaign.status !== CAMPAIGN_STATUS.PAUSED &&
    campaign.status !== CAMPAIGN_STATUS.MANUALLY_PAUSED
  ) {
    const error = new Error('Campaign is not paused');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    status: CAMPAIGN_STATUS.ACTIVE,
    pauseReason: null,
  });

  await CampaignActivityLog.create({
    campaignId,
    action: CAMPAIGN_ACTION.MANUALLY_RESUMED,
    performedBy: advertiserId,
  });

  return {
    campaignId,
    status: CAMPAIGN_STATUS.ACTIVE,
    remainingBudget: campaign.remainingBudget,
  };
};

// ----------------------
// 6. ضبط خيار الاستئناف التلقائي
// ----------------------
const setAutoResume = async (campaignId, advertiserId, autoResumeOnRecharge) => {
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  await Campaign.findByIdAndUpdate(campaignId, { autoResumeOnRecharge });

  return {
    campaignId,
    autoResumeOnRecharge,
  };
};

// ----------------------
// 7. [Sprint 4] إرجاع الميزانية غير المصروفة للمحفظة (عند إلغاء حملة بسبب مخالفة)
// ----------------------
/**
 * ⚠️ لازم تُستدعى داخل transaction يملكها المستدعي (report.service.reviewReport):
 *    const session = await mongoose.startSession(); session.startTransaction(); ...
 *
 * آمنة بفضل Funding fix: الحملة التي لها walletId خُصمت ميزانيتها فعلاً من المحفظة،
 * أما الحملة بلا walletId فلا يُرجَع لها شيء (لم يُخصم شيء أصلاً).
 *
 * لا تغيّر status ولا تسجّل في ActivityLog (المستدعي يفعل ذلك).
 * totalBudget تبقى كما هي (سجل تاريخي)، و remainingBudget تصبح 0.
 *
 * @param {string|ObjectId} campaignId
 * @param {ClientSession} session
 * @returns {Promise<{ amount: number, walletBalanceAfter: number, transactionId: ObjectId } | null>}
 *          null إذا لا يوجد ما يُرجَع
 */
const releaseCampaignBudget = async (campaignId, session) => {
  const campaign = await Campaign.findById(campaignId).session(session);

  if (!campaign) {
    const error = new Error('Campaign not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const amount = campaign.walletId ? campaign.remainingBudget || 0 : 0;
  if (amount <= 0) return null;

  const wallet = await Wallet.findByIdAndUpdate(
    campaign.walletId,
    { $inc: { balance: amount } },
    { session, returnDocument: 'after' }
  );

  if (!wallet) {
    const error = new Error('Wallet not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  await Campaign.findByIdAndUpdate(
    campaignId,
    { $set: { remainingBudget: 0 } },
    { session }
  );

  const transaction = await Transaction.create(
    [
      {
        walletId: wallet._id,
        type: TRANSACTION_TYPE.CREDIT,
        grossAmount: amount,
        commission: 0,
        netAmount: amount,
        currency: 'USD',
        paymentMethod: null,
        status: TRANSACTION_STATUS.COMPLETED,
        description: `Budget returned from cancelled campaign: ${campaign.name}`,
        campaignId,
      },
    ],
    { session }
  );

  return {
    amount,
    walletBalanceAfter: wallet.balance,
    transactionId: transaction[0]._id,
  };
};

module.exports = {
  allocateBudget,
  setDailyBudgetLimit,
  rechargeCampaign,
  pauseCampaign,
  resumeCampaign,
  setAutoResume,
  releaseCampaignBudget,
};