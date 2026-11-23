const migration = require('../migrations/001-sprint4-campaign-fields');

test('Sprint 4 migration backfills each missing campaign field without replacing present values', async () => {
  const calls = [];
  const Campaign = {
    updateMany: jest.fn(async (filter, update) => {
      calls.push({ filter, update });
      return { modifiedCount: 1 };
    }),
  };

  const result = await migration.up({ Campaign });

  expect(migration.version).toBe('001-sprint4-campaign-fields');
  expect(calls).toEqual([
    { filter: { isSuspended: { $exists: false } }, update: { $set: { isSuspended: false } } },
    { filter: { suspensionReason: { $exists: false } }, update: { $set: { suspensionReason: null } } },
    { filter: { suspendedAt: { $exists: false } }, update: { $set: { suspendedAt: null } } },
    { filter: { applicantsCount: { $exists: false } }, update: { $set: { applicantsCount: 0 } } },
  ]);
  expect(result).toEqual({
    isSuspended: 1,
    suspensionReason: 1,
    suspendedAt: 1,
    applicantsCount: 1,
  });
});

test('Sprint 6–10 migration provisions campaign budget history and view/creator finance indexes', async () => {
  const modelNames = [
    ['../models/CampaignBudgetSnapshot', 'campaignbudgetsnapshots'],
    ['../models/SubmissionViewSnapshot', 'submissionviewsnapshots'],
    ['../models/CreatorWallet', 'creatorwallets'],
    ['../models/CreatorEarning', 'creatorearnings'],
    ['../models/CreatorPaymentMethod', 'creatorpaymentmethods'],
    ['../models/WithdrawalRequest', 'withdrawalrequests'],
  ];
  const models = new Map();
  for (const [modulePath, collectionName] of modelNames) {
    const model = {
      collection: { collectionName },
      createCollection: jest.fn().mockResolvedValue(undefined),
      createIndexes: jest.fn().mockResolvedValue([]),
    };
    models.set(modulePath, model);
    jest.doMock(modulePath, () => model);
  }

  const Submission = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 4 }),
    collection: { createIndex: jest.fn().mockResolvedValue('status_view_tracking_poll_approved') },
  };
  jest.doMock('../models/submission', () => Submission);

  let financialMigration;
  jest.isolateModules(() => {
    financialMigration = require('../migrations/002-sprint6-10-financial-indexes');
  });
  const result = await financialMigration.up();

  expect(financialMigration.version).toBe('002-sprint6-10-financial-indexes');
  for (const model of models.values()) {
    expect(model.createCollection).toHaveBeenCalledTimes(1);
    expect(model.createIndexes).toHaveBeenCalledTimes(1);
  }
  expect(Submission.updateMany).toHaveBeenCalledWith(
    { viewTrackingHighWaterViews: { $exists: false } },
    { $set: { viewTrackingHighWaterViews: null, viewTrackingHighWaterCountryViews: [] } },
  );
  expect(Submission.collection.createIndex).toHaveBeenCalledWith(
    { status: 1, viewTrackingPolledAt: 1, approvedAt: 1 },
    { name: 'status_view_tracking_poll_approved' },
  );
  expect(result.collections).toContain('campaignbudgetsnapshots');
  expect(result.indexSetsCreated).toBe(7);
  expect(result.submissionsBackfilled).toBe(4);

  for (const [modulePath] of modelNames) jest.dontMock(modulePath);
  jest.dontMock('../models/submission');
});
