const Wallet = require('../../models/wallet');
const Campaign = require('../../models/campaign');
const { CAMPAIGN_STATUS } = require('../../constants/campaign.constants');

/**
 * حساب الرصيد الحر للمعلن
 * freeBalance = wallet.balance − SUM(remainingBudget of ACTIVE campaigns)
 *
 * @param {string} walletId
 * @returns {Promise<{ freeBalance: number, walletBalance: number, reservedBalance: number }>}
 */
const calculateFreeBalance = async (walletId) => {
  const wallet = await Wallet.findById(walletId).select('balance advertiserId');

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const activeCampaigns = await Campaign.find({
    walletId,
    status: CAMPAIGN_STATUS.ACTIVE,
  }).select('remainingBudget');

  const reservedBalance = activeCampaigns.reduce(
    (sum, c) => sum + (c.remainingBudget || 0),
    0
  );

// الميزانيات المخصصة للحملات خُصمت من wallet.balance أصلًا (allocateBudget / rechargeCampaign)，
// فالرصيد الحر هو رصيد المحفظة الحالي نفسه. reservedBalance للعرض فقط.
const freeBalance = Math.max(0, wallet.balance);

  return {
    freeBalance,
    walletBalance: wallet.balance,
    reservedBalance,
  };
};

module.exports = { calculateFreeBalance };