require('dotenv').config();

const mongoose = require('mongoose');
const db = require('./helpers/db');
const { createBrand, createCampaign } = require('./helpers/factories');
const Campaign = require('../models/campaign');
const { runMigrations } = require('../../scripts/migrate');

jest.setTimeout(120000);

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(db.clearDatabase);

test('applies the versioned Sprint 4 data migration once and fills only missing values', async () => {
  const brand = await createBrand();
  const campaign = await createCampaign(brand, { isSuspended: true, applicantsCount: 7 });
  const existingValues = await createCampaign(brand, {
    isSuspended: true,
    suspensionReason: 'confirmed-report',
    suspendedAt: new Date('2026-01-01T00:00:00.000Z'),
    applicantsCount: 7,
  });
  await Campaign.collection.updateOne(
    { _id: campaign._id },
    { $unset: { isSuspended: '', applicantsCount: '', suspensionReason: '', suspendedAt: '' } }
  );

  const firstRun = await runMigrations({ only: '001-sprint4-campaign-fields' });
  const migrated = await Campaign.findById(campaign._id).lean();

  expect(firstRun[0].status).toBe('applied');
  expect(migrated.isSuspended).toBe(false);
  expect(migrated.suspensionReason).toBeNull();
  expect(migrated.suspendedAt).toBeNull();
  expect(migrated.applicantsCount).toBe(0);

  const unchanged = await Campaign.findById(existingValues._id).lean();
  expect(unchanged.isSuspended).toBe(true);
  expect(unchanged.suspensionReason).toBe('confirmed-report');
  expect(unchanged.applicantsCount).toBe(7);

  const secondRun = await runMigrations({ only: '001-sprint4-campaign-fields' });
  expect(secondRun[0].status).toBe('already_applied');
  expect(await mongoose.connection.collection('schema_migrations').countDocuments()).toBe(1);
});
