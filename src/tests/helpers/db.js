// tests/helpers/db.js
// قاعدة بيانات في الذاكرة بوضع replica set (المعاملات لا تعمل بدونه).
// ⚠️ أول تشغيل ينزّل ملف mongod (يحتاج إنترنت) فقد يستغرق دقيقة؛ ارفع مهلة الاختبار:
//     jest.setTimeout(120000);
//
// الاستعمال:
//   const db = require('./helpers/db');
//   beforeAll(db.connect);
//   afterEach(db.clearDatabase);
//   afterAll(db.disconnect);
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

const connect = async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // نبني الفهارس قبل الاختبارات (الفهرس الفريد الجزئي مهم لاختبارات منع التكرار)
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};

const clearDatabase = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

const disconnect = async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
};

module.exports = { connect, clearDatabase, disconnect };