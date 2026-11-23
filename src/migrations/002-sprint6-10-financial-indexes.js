const version = '002-sprint6-10-financial-indexes';

const up = async () => {
  const CampaignBudgetSnapshot = require('../models/CampaignBudgetSnapshot');
  const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
  const Submission = require('../models/submission');
  const CreatorWallet = require('../models/CreatorWallet');
  const CreatorEarning = require('../models/CreatorEarning');
  const CreatorPaymentMethod = require('../models/CreatorPaymentMethod');
  const WithdrawalRequest = require('../models/WithdrawalRequest');
  const models = [
    CampaignBudgetSnapshot,
    SubmissionViewSnapshot,
    CreatorWallet,
    CreatorEarning,
    CreatorPaymentMethod,
    WithdrawalRequest,
  ];
  await Promise.all(models.map((model) => model.createCollection().catch((error) => {
    if (error.codeName !== 'NamespaceExists') throw error;
  })));
  const indexes = await Promise.all(models.map((model) => model.createIndexes()));
  const backfill = await Submission.updateMany(
    { viewTrackingHighWaterViews: { $exists: false } },
    { $set: { viewTrackingHighWaterViews: null, viewTrackingHighWaterCountryViews: [] } }
  );
  await Submission.collection.createIndex(
    { status: 1, viewTrackingPolledAt: 1, approvedAt: 1 },
    { name: 'status_view_tracking_poll_approved' }
  );
  return {
    collections: models.map((model) => model.collection.collectionName),
    indexSetsCreated: indexes.length + 1,
    submissionsBackfilled: backfill.modifiedCount,
  };
};

module.exports = { version, up };
