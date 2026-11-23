require('dotenv').config();
const mongoose = require('mongoose');
const { runMigrations } = require('./migrate');

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required to run migrations.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    await runMigrations({ only: '001-sprint4-campaign-fields' });
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('migrateSprint4 failed:', error.message);
  process.exitCode = 1;
});
