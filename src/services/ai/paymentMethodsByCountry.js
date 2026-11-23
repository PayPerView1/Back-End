const { PAYMENT_METHOD } = require('../../constants/payment.constants');

const CREATOR_METHODS = new Set(['PAYPAL', 'BANK_TRANSFER', 'STC_PAY', 'MADA', 'OTHER']);

const parsePaymentMethodsByCountry = (source = process.env.PAYMENT_METHODS_BY_COUNTRY) => {
  try {
    const parsed = JSON.parse(source || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const allowed = new Set([...Object.values(PAYMENT_METHOD), ...CREATOR_METHODS]);
    return Object.fromEntries(Object.entries(parsed)
      .filter(([country, methods]) => /^[A-Z]{2,3}$/i.test(country) && Array.isArray(methods))
      .map(([country, methods]) => [country.toUpperCase(), [...new Set(methods.filter((method) => allowed.has(method)))]]));
  } catch {
    return {};
  }
};

module.exports = { parsePaymentMethodsByCountry };
