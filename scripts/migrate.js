require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Campaign = require('../src/models/campaign');

const migrationsDirectory = path.join(__dirname, '..', 'src', 'migrations');
const migrationFiles = () =>
  fs.readdirSync(migrationsDirectory)
    .filter((name) => /^\d{3}-[a-z0-9-]+\.js$/i.test(name))
    .sort();

const runMigrations = async ({ only } = {}) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Connect to MongoDB before running migrations.');
  }

  const files = migrationFiles();
  const selected = only ? files.filter((file) => file === `${only}.js`) : files;
  if (only && selected.length === 0) {
    throw new Error(`Migration not found: ${only}`);
  }

  const history = mongoose.connection.collection('schema_migrations');
  await history.createIndex({ version: 1 }, { unique: true });

  const results = [];
  for (const file of selected) {
    const migration = require(path.join(migrationsDirectory, file));
    const alreadyApplied = await history.findOne({ version: migration.version });
    if (alreadyApplied) {
      results.push({ version: migration.version, status: 'already_applied' });
      console.log(`Skipped ${migration.version} (already applied).`);
      continue;
    }

    const details = await migration.up({ Campaign });
    try {
      await history.insertOne({ version: migration.version, appliedAt: new Date() });
    } catch (error) {
      // A second runner may have recorded an idempotent migration concurrently.
      if (error.code !== 11000) throw error;
    }

    results.push({ version: migration.version, status: 'applied', details });
    console.log(`Applied ${migration.version}.`);
  }

  return results;
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required to run migrations.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    await runMigrations();
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { runMigrations };
