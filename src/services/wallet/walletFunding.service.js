// src/services/wallet/walletFunding.service.js

const mongoose = require('mongoose');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const BankTransfer = require('../../models/bankTransfer');
const PlatformLedger = require('../../models/platformLedger');
const paypalService = require('./paypal.service');
const { calculateCommission } = require('../../utils/wallet/commission.utils');
const {
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  PAYMENT_METHOD,
  BANK_TRANSFER_STATUS,
} = require('../../constants/payment.constants');
const {
  sendFundingSuccessEmail,
  sendFundingFailedEmail,
  sendBankTransferReceivedEmail,
  sendBankTransferApprovedEmail,
  sendBankTransferRejectedEmail,
} = require('../emailService');

// ----------------------
// جلب أو إنشاء محفظة المعلن
// ----------------------
const getOrCreateWallet = async (advertiserId) => {
  let wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) {
    wallet = await Wallet.create({ advertiserId });
  }
  return wallet;
};

// ----------------------
// بدء عملية الشحن
// ----------------------
const initiateFunding = async (advertiserId, amount, paymentMethod) => {
  const wallet = await getOrCreateWallet(advertiserId);
  const { commission, netAmount, commissionRate } = calculateCommission(amount);

  if (paymentMethod === PAYMENT_METHOD.PAYPAL) {
    // إنشاء transaction بحالة PENDING أولاً
    const transaction = await Transaction.create({
      walletId: wallet._id,
      type: TRANSACTION_TYPE.CREDIT,
      grossAmount: amount,
      commission,
      netAmount,
      currency: 'USD',
      paymentMethod: PAYMENT_METHOD.PAYPAL,
      status: TRANSACTION_STATUS.PENDING,
      description: 'Wallet top-up via PayPal',
    });

    // إنشاء PayPal order وتمرير transactionId كـ custom_id
    const { orderId, redirectUrl } = await paypalService.createOrder(
      amount,
      transaction._id.toString()
    );

    // حفظ orderId كـ referenceId
    transaction.referenceId = orderId;
    await transaction.save();

    return {
      transactionId: transaction._id,
      paymentMethod: PAYMENT_METHOD.PAYPAL,
      grossAmount: amount,
      commissionRate,
      commission,
      netAmount,
      currency: 'USD',
      status: TRANSACTION_STATUS.PENDING,
      redirectUrl,
    };
  }

  if (paymentMethod === PAYMENT_METHOD.BANK_TRANSFER) {
    const transaction = await Transaction.create({
      walletId: wallet._id,
      type: TRANSACTION_TYPE.CREDIT,
      grossAmount: amount,
      commission,
      netAmount,
      currency: 'USD',
      paymentMethod: PAYMENT_METHOD.BANK_TRANSFER,
      status: TRANSACTION_STATUS.UNDER_REVIEW,
      description: 'Wallet top-up via bank transfer',
    });

    return {
      transactionId: transaction._id,
      paymentMethod: PAYMENT_METHOD.BANK_TRANSFER,
      grossAmount: amount,
      commissionRate,
      commission,
      netAmount,
      currency: 'USD',
      status: TRANSACTION_STATUS.UNDER_REVIEW,
      bankDetails: {
        bankName: process.env.BANK_NAME,
        beneficiaryName: process.env.BANK_BENEFICIARY_NAME,
        iban: process.env.BANK_IBAN,
        swiftCode: process.env.BANK_SWIFT_CODE,
      },
      uploadReceiptUrl: '/api/wallet/bank-transfer/upload',
    };
  }
};

// ----------------------
// معالجة PayPal Webhook
// ----------------------
const processPaypalWebhook = async (headers, rawBody) => {
  // 1. التحقق من الـ signature
  const isValid = await paypalService.verifyWebhookSignature(headers, rawBody);
  if (!isValid) {
    const error = new Error('Invalid webhook signature');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event_type;

  // 2. نتعامل فقط مع PAYMENT.CAPTURE.COMPLETED
  if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
    // باقي الـ events نتجاهلها بهدوء
    return { ignored: true };
  }

  const resource = event.resource;
  const referenceId = resource.id; // PayPal capture ID
  const transactionId = resource.custom_id; // الـ ID الذي حفظناه

  // 3. Idempotency — تحقق إذا هذا الـ referenceId عولج مسبقاً
  const existingTransaction = await Transaction.findOne({ referenceId });
  if (existingTransaction && existingTransaction.status === TRANSACTION_STATUS.COMPLETED) {
    return { duplicate: true };
  }

  // 4. جلب الـ transaction
  const transaction = await Transaction.findById(transactionId).populate('walletId');
  if (!transaction) {
    const error = new Error('Transaction not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 5. العملية الأتومية: تحديث الرصيد + تحديث الـ transaction + تسجيل العمولة
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // تحديث رصيد المحفظة
    await Wallet.findByIdAndUpdate(
      transaction.walletId._id,
      { $inc: { balance: transaction.netAmount } },
      { session }
    );

    // تحديث حالة الـ transaction
    await Transaction.findByIdAndUpdate(
      transaction._id,
      {
        status: TRANSACTION_STATUS.COMPLETED,
        referenceId,
      },
      { session }
    );

    // تسجيل العمولة في platform_ledger
    await PlatformLedger.create(
      [
        {
          transactionId: transaction._id,
          commission: transaction.commission,
          currency: transaction.currency,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // 6. جلب المحفظة المحدثة لإرسال الإيميل
  const updatedWallet = await Wallet.findById(transaction.walletId._id);
  const advertiser = await mongoose.model('User').findById(updatedWallet.advertiserId);

  // 7. إرسال إيميل تأكيد
  await sendFundingSuccessEmail(advertiser, {
    grossAmount: transaction.grossAmount,
    commission: transaction.commission,
    netAmount: transaction.netAmount,
    newBalance: updatedWallet.balance,
    paymentMethod: PAYMENT_METHOD.PAYPAL,
  });

  return { success: true };
};

// ----------------------
// رفع إيصال التحويل البنكي
// ----------------------
const uploadBankTransferReceipt = async (transactionId, advertiserId, receiptUrl) => {
  // التحقق أن الـ transaction تخص هذا المعلن
  const wallet = await Wallet.findOne({ advertiserId });
  if (!wallet) {
    const error = new Error('Wallet not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const transaction = await Transaction.findOne({
    _id: transactionId,
    walletId: wallet._id,
    paymentMethod: PAYMENT_METHOD.BANK_TRANSFER,
  });

  if (!transaction) {
    const error = new Error('Transaction not found or does not belong to you');
    error.code = 'NOT_FOUND';
    throw error;
  }

  // إنشاء سجل bank_transfer
  const bankTransfer = await BankTransfer.create({
    transactionId: transaction._id,
    receiptUrl,
    status: BANK_TRANSFER_STATUS.PENDING,
  });

  // إرسال إيميل تأكيد الاستلام
  const advertiser = await mongoose.model('User').findById(advertiserId);
  await sendBankTransferReceivedEmail(advertiser, {
    amount: transaction.grossAmount,
    transactionId: transaction._id,
  });

  return {
    bankTransferId: bankTransfer._id,
    transactionId: transaction._id,
    receiptUrl,
    status: BANK_TRANSFER_STATUS.PENDING,
    message: 'Receipt uploaded. Your transfer will be reviewed within 24–48 hours.',
  };
};

// ----------------------
// موافقة الأدمن على التحويل البنكي
// ----------------------
const approveBankTransfer = async (bankTransferId, adminId) => {
  const bankTransfer = await BankTransfer.findById(bankTransferId).populate('transactionId');
  if (!bankTransfer) {
    const error = new Error('Bank transfer not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const transaction = bankTransfer.transactionId;
  const { commission, netAmount } = calculateCommission(transaction.grossAmount);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // تحديث رصيد المحفظة
    await Wallet.findByIdAndUpdate(
      transaction.walletId,
      { $inc: { balance: netAmount } },
      { session }
    );

    // تحديث حالة الـ transaction
    await Transaction.findByIdAndUpdate(
      transaction._id,
      {
        status: TRANSACTION_STATUS.COMPLETED,
        commission,
        netAmount,
      },
      { session }
    );

    // تحديث حالة الـ bank_transfer
    await BankTransfer.findByIdAndUpdate(
      bankTransferId,
      {
        status: BANK_TRANSFER_STATUS.APPROVED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      { session }
    );

    // تسجيل العمولة
    await PlatformLedger.create(
      [
        {
          transactionId: transaction._id,
          commission,
          currency: transaction.currency,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const updatedWallet = await Wallet.findById(transaction.walletId);
  const advertiser = await mongoose.model('User').findById(updatedWallet.advertiserId);

  await sendBankTransferApprovedEmail(advertiser, {
    netAmount,
    newBalance: updatedWallet.balance,
  });

  return {
    bankTransferId,
    action: 'APPROVED',
    transactionId: transaction._id,
    grossAmount: transaction.grossAmount,
    commission,
    netAmount,
    newWalletBalance: updatedWallet.balance,
  };
};

// ----------------------
// رفض الأدمن للتحويل البنكي
// ----------------------
const rejectBankTransfer = async (bankTransferId, adminId, note) => {
  const bankTransfer = await BankTransfer.findById(bankTransferId).populate('transactionId');
  if (!bankTransfer) {
    const error = new Error('Bank transfer not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const transaction = bankTransfer.transactionId;

  await BankTransfer.findByIdAndUpdate(bankTransferId, {
    status: BANK_TRANSFER_STATUS.REJECTED,
    reviewedBy: adminId,
    reviewedAt: new Date(),
    rejectionNote: note,
  });

  await Transaction.findByIdAndUpdate(transaction._id, {
    status: TRANSACTION_STATUS.FAILED,
  });

  const wallet = await Wallet.findById(transaction.walletId);
  const advertiser = await mongoose.model('User').findById(wallet.advertiserId);

  await sendBankTransferRejectedEmail(advertiser, {
    amount: transaction.grossAmount,
    note,
  });

  return {
    bankTransferId,
    action: 'REJECTED',
    note,
  };
};

module.exports = {
  getOrCreateWallet,
  initiateFunding,
  processPaypalWebhook,
  uploadBankTransferReceipt,
  approveBankTransfer,
  rejectBankTransfer,
};