// src/utils/wallet/commission.utils.js

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE) || 0.025;

/**
 * حساب العمولة والمبلغ الصافي
 * @param {number} grossAmount - المبلغ الإجمالي الذي دفعه المعلن
 * @returns {{ commission: number, netAmount: number, commissionRate: number }}
 */
const calculateCommission = (grossAmount) => {
  const commission = parseFloat((grossAmount * COMMISSION_RATE).toFixed(2));
  const netAmount = parseFloat((grossAmount - commission).toFixed(2));

  return {
    commission,
    netAmount,
    commissionRate: COMMISSION_RATE,
  };
};

module.exports = { calculateCommission };