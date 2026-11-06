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

const connect = async () => {
  if (!process.env.MONGO_URI_TEST) {
    throw new Error('MONGO_URI_TEST is not defined in .env file');
  }

  // الاتصال بقاعدة بيانات الاختبار الحقيقية
  await mongoose.connect(process.env.MONGO_URI_TEST);
  
  // نبني الفهارس قبل الاختبارات (الفهرس الفريد الجزئي مهم لاختبارات منع التكرار)
  // هذا السطر مهم جداً لضمان عمل القيود (Unique Constraints) بشكل صحيح
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};

const clearDatabase = async () => {
  const { collections } = mongoose.connection;
  // مسح جميع البيانات من كل الجداول
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

const disconnect = async () => {
  // قطع الاتصال بقاعدة البيانات
  await mongoose.disconnect();
};

module.exports = { connect, clearDatabase, disconnect };