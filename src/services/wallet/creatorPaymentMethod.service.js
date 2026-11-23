const mongoose = require('mongoose');
const CreatorPaymentMethod = require('../../models/CreatorPaymentMethod');
const { AppError } = require('../../utils/errors');
const { encryptDetails, fingerprint } = require('./paymentDetailsCrypto.service');

const toDto = (method) => ({
  id: method._id,
  type: method.type,
  label: method.label,
  last4: method.last4,
  isDefault: method.isDefault,
  createdAt: method.createdAt,
});

const listPaymentMethods = async (creatorId) => {
  const methods = await CreatorPaymentMethod.find({ creatorId, isActive: true })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();
  return methods.map(toDto);
};

const addPaymentMethod = async (creatorId, { type, label, details, isDefault }) => {
  const encrypted = encryptDetails(details);
  const methodFingerprint = fingerprint(type, details.accountIdentifier);
  const session = await mongoose.startSession();
  let method;
  try {
    await session.withTransaction(async () => {
      const hasExisting = await CreatorPaymentMethod.exists({ creatorId, isActive: true }).session(session);
      const shouldDefault = Boolean(isDefault) || !hasExisting;
      if (shouldDefault) {
        await CreatorPaymentMethod.updateMany(
          { creatorId, isActive: true },
          { $set: { isDefault: false } },
          { session }
        );
      }
      [method] = await CreatorPaymentMethod.create([{
        creatorId,
        type,
        label,
        details: encrypted,
        fingerprint: methodFingerprint,
        last4: String(details.accountIdentifier).replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase().padStart(4, '0'),
        isDefault: shouldDefault,
      }], { session });
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('An active payment method already uses these account details', 'PAYMENT_METHOD_EXISTS');
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return toDto(method);
};

const removePaymentMethod = async (creatorId, methodId) => {
  if (!mongoose.Types.ObjectId.isValid(methodId)) throw new AppError('Payment method not found', 'NOT_FOUND');
  const session = await mongoose.startSession();
  let method;
  try {
    await session.withTransaction(async () => {
      const current = await CreatorPaymentMethod.findOne({ _id: methodId, creatorId, isActive: true }).session(session);
      if (!current) throw new AppError('Payment method not found', 'NOT_FOUND');
      if (current.pendingWithdrawals > 0) throw new AppError('Payment method has a withdrawal in progress', 'PAYMENT_METHOD_IN_USE');
      method = await CreatorPaymentMethod.findOneAndUpdate(
        { _id: methodId, creatorId, isActive: true, pendingWithdrawals: 0 },
        { $set: { isActive: false, isDefault: false } },
        { new: true, session }
      );
      if (!method) throw new AppError('Payment method has a withdrawal in progress', 'PAYMENT_METHOD_IN_USE');
      if (current.isDefault) {
        const nextDefault = await CreatorPaymentMethod.findOne({ creatorId, isActive: true })
          .sort({ createdAt: 1 })
          .session(session);
        if (nextDefault) {
          await CreatorPaymentMethod.updateOne(
            { _id: nextDefault._id },
            { $set: { isDefault: true } },
            { session }
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return { id: method._id, isActive: false };
};

module.exports = { listPaymentMethods, addPaymentMethod, removePaymentMethod, toDto };
