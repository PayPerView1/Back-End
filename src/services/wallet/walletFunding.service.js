// src/services/wallet/walletFunding.service.js

const mongoose = require('mongoose');
const Wallet         = require('../../models/wallet');
const Transaction    = require('../../models/transaction');
const BankTransfer   = require('../../models/bankTransfer');
const PlatformLedger = require('../../models/platformLedger');
const paypalService  = require('./paypal.service');
const moyasarService = require('./moyasar.service');
const { calculateCommission } = require('../../utils/wallet/commission.utils');
const {
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  PAYMENT_METHOD,
  BANK_TRANSFER_STATUS,
} = require('../../constants/payment.constants');
const {
  sendFundingSuccessEmail,
  sendBankTransferReceivedEmail,
  sendBankTransferApprovedEmail,
  sendBankTransferRejectedEmail,
} = require('../emailService');

// ======================================================
// Helpers
// ======================================================

const makeError = (message, code) => {
  const error = new Error(message);
  error.code  = code;
  return error;
};

// تقريب لخانتين عشريتين + تحويل لسنتات للمقارنة الآمنة
const roundMoney = (n) => Math.round(Number(n) * 100) / 100;
const toCents    = (n) => Math.round(Number(n) * 100);

// الدفعة المؤكدة من البوابة تُقبل حتى لو الـ transaction أُلغيت/فشلت مسبقاً
// (المال وصل فعلاً). الشرط الوحيد: ألا تكون COMPLETED.
const GATEWAY_PAYABLE_STATUSES = [
  TRANSACTION_STATUS.PENDING,
  TRANSACTION_STATUS.CANCELLED,
  TRANSACTION_STATUS.FAILED,
];

const DESCRIPTIONS = {
  [PAYMENT_METHOD.PAYPAL]:        'Wallet top-up via PayPal',
  [PAYMENT_METHOD.MOYASAR]:       'Wallet top-up via Moyasar',
  [PAYMENT_METHOD.BANK_TRANSFER]: 'Wallet top-up via bank transfer',
};

// فشل الإيميل يجب ألا يُفشل العملية بعد أن أُضيف المال
const safeEmail = async (label, fn) => {
  try {
    await fn();
  } catch (error) {
    console.error(`[walletFunding.service] ${label} email failed:`, error.message);
  }
};

const loadWalletAndAdvertiser = async (walletId) => {
  const wallet     = await Wallet.findById(walletId);
  const advertiser = wallet
    ? await mongoose.model('User').findById(wallet.advertiserId)
    : null;
  return { wallet, advertiser };
};

const notifyFundingSuccess = (transaction, paymentMethod) =>
  safeEmail('funding success', async () => {
    const { wallet, advertiser } = await loadWalletAndAdvertiser(transaction.walletId);
    if (!advertiser) return;
    await sendFundingSuccessEmail(advertiser, {
      grossAmount:   transaction.grossAmount,
      commission:    transaction.commission,
      netAmount:     transaction.netAmount,
      newBalance:    wallet.balance,
      paymentMethod,
    });
  });

const assertAmountMatches = (transaction, paidCents, currency) => {
  if (
    String(currency).toUpperCase() !== 'USD' ||
    paidCents !== toCents(transaction.grossAmount)
  ) {
    throw makeError('Paid amount does not match transaction amount', 'VALIDATION_ERROR');
  }
};

// ----------------------
// Helper مشترك: حجز الـ transaction + تحديث الرصيد + تسجيل العمولة
// الحجز الشرطي (status ∈ fromStatuses) هو ضمان الـ idempotency:
// لو سبقنا webhook أو capture آخر، يرجع null ولا يُشحن الرصيد مرتين.
// يجب استدعاؤه داخل session.
// ----------------------
const creditWalletAtomic = async (
  transaction,
  paymentMethod,
  session,
  { extraFields = {}, fromStatuses = GATEWAY_PAYABLE_STATUSES } = {}
) => {
  const claimed = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: { $in: fromStatuses } },
    { status: TRANSACTION_STATUS.COMPLETED, ...extraFields },
    { session, new: true }
  );
  if (!claimed) return null;

  const wallet = await Wallet.findByIdAndUpdate(
    claimed.walletId,
    {
      $inc: { balance: claimed.netAmount },
      lastPaymentMethod: paymentMethod,
    },
    { session, new: true }
  );
  if (!wallet) throw makeError('Wallet not found', 'NOT_FOUND');

  await PlatformLedger.create(
    [
      {
        transactionId: claimed._id,
        commission:    claimed.commission,
        currency:      claimed.currency,
      },
    ],
    { session }
  );

  return claimed;
};

// تشغيل creditWalletAtomic في session خاصة (للبوابات: PayPal / Moyasar)
const creditGatewayPayment = async (transaction, paymentMethod, extraFields) => {
  const session = await mongoose.startSession();
  let claimed = null;
  try {
    await session.withTransaction(async () => {
      claimed = null; // withTransaction قد يعيد تشغيل الـ callback
      claimed = await creditWalletAtomic(transaction, paymentMethod, session, { extraFields });
    });
  } finally {
    session.endSession();
  }
  return claimed;
};

const markTransactionFailed = (transactionId) =>
  Transaction.updateOne(
    { _id: transactionId, status: TRANSACTION_STATUS.PENDING },
    { status: TRANSACTION_STATUS.FAILED }
  ).catch((error) =>
    console.error('[walletFunding.service] markTransactionFailed error:', error.message)
  );

// ----------------------
// جلب أو إنشاء محفظة المعلن (آمن عند الطلبات المتزامنة)
// ----------------------
const getOrCreateWallet = async (advertiserId) => {
  return Wallet.findOneAndUpdate(
    { advertiserId },
    { $setOnInsert: { advertiserId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// ======================================================
// بدء عملية الشحن
// ======================================================
const initiateFunding = async (advertiserId, amount, paymentMethod) => {
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    throw makeError('Unsupported payment method', 'VALIDATION_ERROR');
  }

  const grossAmount = roundMoney(amount);
  const wallet      = await getOrCreateWallet(advertiserId);
  const { commission, netAmount, commissionRate } = calculateCommission(grossAmount);

  const isBankTransfer = paymentMethod === PAYMENT_METHOD.BANK_TRANSFER;

  const transaction = await Transaction.create({
    walletId:      wallet._id,
    type:          TRANSACTION_TYPE.CREDIT,
    grossAmount,
    commission,
    netAmount,
    currency:      'USD',
    paymentMethod,
    status:        isBankTransfer ? TRANSACTION_STATUS.UNDER_REVIEW : TRANSACTION_STATUS.PENDING,
    description:   DESCRIPTIONS[paymentMethod],
  });

  const baseResponse = {
    transactionId: transaction._id,
    paymentMethod,
    grossAmount,
    commissionRate,
    commission,
    netAmount,
    currency:      'USD',
    status:        transaction.status,
  };

  // ──────────────── PayPal ────────────────
  if (paymentMethod === PAYMENT_METHOD.PAYPAL) {
    try {
      const { orderId, redirectUrl } = await paypalService.createOrder(
        grossAmount,
        transaction._id.toString()
      );
      transaction.referenceId = orderId; // يبقى order ID ولا يُستبدل
      await transaction.save();
      return { ...baseResponse, redirectUrl };
    } catch (error) {
      await markTransactionFailed(transaction._id);
      throw error;
    }
  }

  // ──────────────── Moyasar (Hosted Invoice) ────────────────
  if (paymentMethod === PAYMENT_METHOD.MOYASAR) {
    try {
      const { invoiceId, invoiceUrl } = await moyasarService.createInvoice(
        grossAmount,
        transaction._id.toString()
      );
      transaction.referenceId = invoiceId; // يبقى invoice ID ولا يُستبدل
      await transaction.save();
      return { ...baseResponse, invoiceUrl };
    } catch (error) {
      await markTransactionFailed(transaction._id);
      throw error;
    }
  }

  // ──────────────── Bank Transfer ────────────────
  return {
    ...baseResponse,
    bankDetails: {
      bankName:        process.env.BANK_NAME,
      beneficiaryName: process.env.BANK_BENEFICIARY_NAME,
      iban:            process.env.BANK_IBAN,
      swiftCode:       process.env.BANK_SWIFT_CODE,
    },
    uploadReceiptUrl: '/api/v1/wallet/bank-transfer/upload',
  };
};

// ======================================================
// PayPal: Capture (يُستدعى من الفرونت بعد عودة المستخدم من PayPal)
// ======================================================
const capturePaypalOrder = async (orderId, advertiserId) => {
  const wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) throw makeError('Wallet not found', 'NOT_FOUND');

  const transaction = await Transaction.findOne({
    referenceId:   orderId,
    walletId:      wallet._id,
    paymentMethod: PAYMENT_METHOD.PAYPAL,
  });
  if (!transaction) throw makeError('Transaction not found', 'NOT_FOUND');

  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    return { transactionId: transaction._id, status: transaction.status, alreadyCompleted: true };
  }

  let capture;
  try {
    capture = await paypalService.captureOrder(orderId);
  } catch (error) {
    const issue = error.response?.data?.details?.[0]?.issue;
    if (issue === 'ORDER_ALREADY_CAPTURED') {
      // طلب متزامن سبقنا: نجلب حالة الـ order الحالية
      capture = await paypalService.getOrder(orderId);
    } else if (issue === 'ORDER_NOT_APPROVED') {
      // المستخدم لم يوافق على الدفع بعد (أو أغلق صفحة PayPal)
      throw makeError('The payment has not been approved yet', 'CONFLICT');
    } else {
      console.error('[walletFunding.service] captureOrder error:', JSON.stringify(error.response?.data || error.message));
      throw error;
    }
  }

  const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];

  if (capture.status !== 'COMPLETED' || captureUnit?.status !== 'COMPLETED') {
    // مثلاً capture بحالة PENDING: ننتظر الـ webhook
    return { transactionId: transaction._id, status: transaction.status };
  }

  assertAmountMatches(transaction, toCents(captureUnit.amount?.value), captureUnit.amount?.currency_code);

  const claimed = await creditGatewayPayment(transaction, PAYMENT_METHOD.PAYPAL, {
    captureId: captureUnit.id,
  });

  if (claimed) await notifyFundingSuccess(claimed, PAYMENT_METHOD.PAYPAL);

  return { transactionId: transaction._id, status: TRANSACTION_STATUS.COMPLETED };
};

// ======================================================
// PayPal Webhook (شبكة أمان بجانب الـ capture)
// ======================================================
const processPaypalWebhook = async (headers, rawBody) => {
  const isValid = await paypalService.verifyWebhookSignature(headers, rawBody);
  if (!isValid) throw makeError('Invalid webhook signature', 'FORBIDDEN');

  const event = JSON.parse(rawBody);

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return { ignored: true };
  }

  const resource      = event.resource;
  const transactionId = resource?.custom_id;

  if (!mongoose.isValidObjectId(transactionId)) {
    throw makeError('Missing or invalid custom_id in PayPal webhook', 'VALIDATION_ERROR');
  }

  const transaction = await Transaction.findOne({
    _id:           transactionId,
    paymentMethod: PAYMENT_METHOD.PAYPAL,
  });
  if (!transaction) throw makeError('Transaction not found', 'NOT_FOUND');

  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    return { duplicate: true };
  }

  assertAmountMatches(transaction, toCents(resource.amount?.value), resource.amount?.currency_code);

  const claimed = await creditGatewayPayment(transaction, PAYMENT_METHOD.PAYPAL, {
    captureId: resource.id,
  });
  if (!claimed) return { duplicate: true };

  await notifyFundingSuccess(claimed, PAYMENT_METHOD.PAYPAL);
  return { success: true };
};

// ======================================================
// Moyasar Webhook
// - الحدث: payment_paid
// - التحقق: secret_token داخل جسم الطلب (وليس HMAC في header)
// - لا نثق بجسم الـ webhook: نجلب الدفعة من Moyasar مباشرة
// ======================================================
const processMoyasarWebhook = async (rawBody) => {
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw makeError('Invalid Moyasar webhook payload', 'VALIDATION_ERROR');
  }

  if (!moyasarService.verifyWebhookToken(event.secret_token)) {
    throw makeError('Invalid Moyasar webhook token', 'FORBIDDEN');
  }

  if (event.type !== 'payment_paid') {
    return { ignored: true };
  }

  const paymentId = event.data?.id;
  if (!paymentId) throw makeError('Missing payment id in Moyasar webhook', 'VALIDATION_ERROR');

  const payment = await moyasarService.getPayment(paymentId);
  if (payment.status !== 'paid') {
    return { ignored: true };
  }

  // الربط بالـ transaction: invoice_id أولاً، وmetadata كبديل
  const conditions = [];
  if (payment.invoice_id) {
    conditions.push({ referenceId: payment.invoice_id });
  }
  if (mongoose.isValidObjectId(payment.metadata?.transaction_id)) {
    conditions.push({ _id: payment.metadata.transaction_id });
  }
  if (!conditions.length) {
    throw makeError('Cannot link Moyasar payment to a transaction', 'VALIDATION_ERROR');
  }

  const transaction = await Transaction.findOne({
    paymentMethod: PAYMENT_METHOD.MOYASAR,
    $or:           conditions,
  });
  if (!transaction) throw makeError('Transaction not found', 'NOT_FOUND');

  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    return { duplicate: true };
  }

  // payment.amount من Moyasar بأصغر وحدة (سنت)
  assertAmountMatches(transaction, Number(payment.amount), payment.currency);

  const claimed = await creditGatewayPayment(transaction, PAYMENT_METHOD.MOYASAR, {
    captureId: payment.id,
  });
  if (!claimed) return { duplicate: true };

  await notifyFundingSuccess(claimed, PAYMENT_METHOD.MOYASAR);
  return { success: true };
};

// ======================================================
// رفع إيصال التحويل البنكي
// ======================================================
const uploadBankTransferReceipt = async (transactionId, advertiserId, receiptUrl) => {
  if (!mongoose.isValidObjectId(transactionId)) {
    throw makeError('Transaction not found or does not belong to you', 'NOT_FOUND');
  }

  const wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) throw makeError('Wallet not found', 'NOT_FOUND');

  const transaction = await Transaction.findOne({
    _id:           transactionId,
    walletId:      wallet._id,
    paymentMethod: PAYMENT_METHOD.BANK_TRANSFER,
  });
  if (!transaction) {
    throw makeError('Transaction not found or does not belong to you', 'NOT_FOUND');
  }

  if (transaction.status !== TRANSACTION_STATUS.UNDER_REVIEW) {
    throw makeError('This transaction is no longer awaiting a receipt', 'CONFLICT');
  }

  // إيصال واحد فعّال فقط لكل transaction (يمنع الموافقة المتعددة = شحن مضاعف)
  const existing = await BankTransfer.findOne({
    transactionId: transaction._id,
    status: { $in: [BANK_TRANSFER_STATUS.PENDING, BANK_TRANSFER_STATUS.APPROVED] },
  });
  if (existing) {
    throw makeError('A receipt was already uploaded for this transaction', 'CONFLICT');
  }

  let bankTransfer;
  try {
    bankTransfer = await BankTransfer.create({
      transactionId: transaction._id,
      receiptUrl,
      status:        BANK_TRANSFER_STATUS.PENDING,
    });
  } catch (error) {
    // في حال أضفت unique partial index على BankTransfer
    if (error.code === 11000) {
      throw makeError('A receipt was already uploaded for this transaction', 'CONFLICT');
    }
    throw error;
  }

  await safeEmail('bank transfer received', async () => {
    const advertiser = await mongoose.model('User').findById(advertiserId);
    await sendBankTransferReceivedEmail(advertiser, {
      amount:        transaction.grossAmount,
      transactionId: transaction._id,
    });
  });

  return {
    bankTransferId: bankTransfer._id,
    transactionId:  transaction._id,
    receiptUrl,
    status:         BANK_TRANSFER_STATUS.PENDING,
    message:        'Receipt uploaded. Your transfer will be reviewed within 24–48 hours.',
  };
};

// ======================================================
// موافقة الأدمن على التحويل البنكي
// ======================================================
const approveBankTransfer = async (bankTransferId, adminId) => {
  if (!mongoose.isValidObjectId(bankTransferId)) {
    throw makeError('Bank transfer not found', 'NOT_FOUND');
  }

  const session = await mongoose.startSession();
  let approved = null;

  try {
    await session.withTransaction(async () => {
      approved = null;

      // 1) حجز الـ bank transfer (PENDING → APPROVED)
      const bankTransfer = await BankTransfer.findOneAndUpdate(
        { _id: bankTransferId, status: BANK_TRANSFER_STATUS.PENDING },
        {
          status:     BANK_TRANSFER_STATUS.APPROVED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
        { session, new: true }
      );

      if (!bankTransfer) {
        const exists = await BankTransfer.exists({ _id: bankTransferId }).session(session);
        throw exists
          ? makeError('This bank transfer was already reviewed', 'CONFLICT')
          : makeError('Bank transfer not found', 'NOT_FOUND');
      }

      // 2) حجز الـ transaction (UNDER_REVIEW → COMPLETED) + الرصيد + العمولة
      //    نستخدم commission/netAmount المخزنين وقت الشحن (ما رآه المعلن)
      const claimed = await creditWalletAtomic(
        { _id: bankTransfer.transactionId },
        PAYMENT_METHOD.BANK_TRANSFER,
        session,
        { fromStatuses: [TRANSACTION_STATUS.UNDER_REVIEW] }
      );
      if (!claimed) {
        throw makeError('The transaction is no longer under review', 'CONFLICT');
      }

      approved = claimed;
    });
  } finally {
    session.endSession();
  }

  const { wallet, advertiser } = await loadWalletAndAdvertiser(approved.walletId);

  if (advertiser) {
    await safeEmail('bank transfer approved', () =>
      sendBankTransferApprovedEmail(advertiser, {
        netAmount:  approved.netAmount,
        newBalance: wallet.balance,
      })
    );
  }

  return {
    bankTransferId,
    action:           'APPROVED',
    transactionId:    approved._id,
    grossAmount:      approved.grossAmount,
    commission:       approved.commission,
    netAmount:        approved.netAmount,
    newWalletBalance: wallet.balance,
  };
};

// ======================================================
// رفض الأدمن للتحويل البنكي
// ======================================================
const rejectBankTransfer = async (bankTransferId, adminId, note) => {
  if (!mongoose.isValidObjectId(bankTransferId)) {
    throw makeError('Bank transfer not found', 'NOT_FOUND');
  }

  const session = await mongoose.startSession();
  let rejected = null;

  try {
    await session.withTransaction(async () => {
      rejected = null;

      const bankTransfer = await BankTransfer.findOneAndUpdate(
        { _id: bankTransferId, status: BANK_TRANSFER_STATUS.PENDING },
        {
          status:        BANK_TRANSFER_STATUS.REJECTED,
          reviewedBy:    adminId,
          reviewedAt:    new Date(),
          rejectionNote: note,
        },
        { session, new: true }
      );

      if (!bankTransfer) {
        const exists = await BankTransfer.exists({ _id: bankTransferId }).session(session);
        throw exists
          ? makeError('This bank transfer was already reviewed', 'CONFLICT')
          : makeError('Bank transfer not found', 'NOT_FOUND');
      }

      const transaction = await Transaction.findOneAndUpdate(
        { _id: bankTransfer.transactionId, status: TRANSACTION_STATUS.UNDER_REVIEW },
        { status: TRANSACTION_STATUS.FAILED },
        { session, new: true }
      );
      if (!transaction) {
        throw makeError('The transaction is no longer under review', 'CONFLICT');
      }

      rejected = transaction;
    });
  } finally {
    session.endSession();
  }

  await safeEmail('bank transfer rejected', async () => {
    const { advertiser } = await loadWalletAndAdvertiser(rejected.walletId);
    if (!advertiser) return;
    await sendBankTransferRejectedEmail(advertiser, {
      amount: rejected.grossAmount,
      note,
    });
  });

  return {
    bankTransferId,
    action: 'REJECTED',
    note,
  };
};

// ======================================================
// تنظيف الـ transactions المعلّقة (PayPal / Moyasar) التي لم تكتمل
// استدعها من job دوري (مثلاً كل ساعة).
// آمن: لو وصلت دفعة متأخرة لاحقاً، creditWalletAtomic يقبلها من CANCELLED.
// ======================================================
const cancelStalePendingTransactions = async (maxAgeHours = 24) => {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const result = await Transaction.updateMany(
    {
      type:          TRANSACTION_TYPE.CREDIT,
      status:        TRANSACTION_STATUS.PENDING,
      paymentMethod: { $in: [PAYMENT_METHOD.PAYPAL, PAYMENT_METHOD.MOYASAR] },
      createdAt:     { $lt: cutoff },
    },
    { status: TRANSACTION_STATUS.CANCELLED }
  );

  return { cancelled: result.modifiedCount };
};

module.exports = {
  getOrCreateWallet,
  initiateFunding,
  capturePaypalOrder,
  processPaypalWebhook,
  processMoyasarWebhook,
  uploadBankTransferReceipt,
  approveBankTransfer,
  rejectBankTransfer,
  cancelStalePendingTransactions,
};