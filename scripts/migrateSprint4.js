// scripts/migrateSprint4.js
// يضيف حقول سبرنت 4 للحملات الموجودة مسبقاً (قيم mongoose الافتراضية
// تُطبَّق على المستندات الجديدة فقط، وليس على المخزّنة).
// آمن عند التكرار. الاستخدام: node scripts/migrateSprint4.js
require('dotenv').config();
const mongoose = require('mongoose');
const Campaign = require('../src/models/campaign');

// ⚠️ عدّل اسم المتغير ليطابق ما تستعمله في src/config/db.js
const MONGO_URI =
  process.env.MONGO_URI;

const run = async () => {
  if (!MONGO_URI) {
    throw new Error('Mongo connection string not found in environment variables');
  }
  await mongoose.connect(MONGO_URI);

  const suspension = await Campaign.updateMany(
    { isSuspended: { $exists: false } },
    { $set: { isSuspended: false, suspensionReason: null, suspendedAt: null } }
  );

  const applicants = await Campaign.updateMany(
    { applicantsCount: { $exists: false } },
    { $set: { applicantsCount: 0 } }
  );

  console.log(`isSuspended fields added to ${suspension.modifiedCount} campaigns`);
  console.log(`applicantsCount added to ${applicants.modifiedCount} campaigns`);
};

run()
  .catch((err) => {
    console.error('migrateSprint4 failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });