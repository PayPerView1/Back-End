// src/utils/wallet/commission.utils.js

const DEFAULT_COMMISSION_RATE = 0.025;

// نسمح بـ 0 (بدون عمولة)، ونرفض القيم غير المنطقية
const parseRate = (value) => {
  const rate = parseFloat(value);
  return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : DEFAULT_COMMISSION_RATE;
};

const COMMISSION_RATE = parseRate(process.env.COMMISSION_RATE);

/**
 * حساب العمولة والمبلغ الصافي
 * الحساب بالسنتات (أعداد صحيحة) لتفادي أخطاء الفاصلة العائمة
 * مثال: 1.005.toFixed(2) === '1.00' في JavaScript
 *
 * @param {number} grossAmount - المبلغ الإجمالي الذي دفعه المعلن
 * @returns {{ commission: number, netAmount: number, commissionRate: number }}
 */
const calculateCommission = (grossAmount) => {
  const grossCents = Math.round(Number(grossAmount) * 100);

  if (!Number.isFinite(grossCents) || grossCents <= 0) {
    const error = new Error('Invalid amount');
    error.code  = 'VALIDATION_ERROR';
    throw error;
  }

  const commissionCents = Math.round(grossCents * COMMISSION_RATE);
  const netCents        = grossCents - commissionCents;

  return {
    commission:     commissionCents / 100,
    netAmount:      netCents / 100,
    commissionRate: COMMISSION_RATE,
  };
};

module.exports = { calculateCommission };