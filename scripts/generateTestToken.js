// generateTestToken.js
// سكريبت مؤقت - شغله مرة وحدة عشان تولد توكن تجريبي تستخدمه بـ Thunder Client
// لحد ما زميلك يخلص authController الحقيقي
//
// طريقة التشغيل: node generateTestToken.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user'); // عدّل المسار حسب مكان الملف عندك
const generateToken = require('./src/utils/generateTokens'); // عدّل المسار حسب مكان الملف عندك

const run = async () => {
  try {
    // بنتصل بقاعدة بياناتك الحقيقية (Atlas) - مش قاعدة بيانات وهمية هالمرة
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // بندور إذا في مستخدم تجريبي أصلاً موجود
    let testUser = await User.findOne({ email: 'test@example.com' });

    // لو مش موجود، بننشئه
    if (!testUser) {
      testUser = await User.create({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'somehashedpassword123', // مؤقت، مش رح نسجل دخول فعليًا فيه
        role: 'CLIPPER',
        country: 'PS',
      });
      console.log('✅ Test user created');
    } else {
      console.log('ℹ️  Test user already exists, reusing it');
    }

    // بنولد توكن صحيح لهاد المستخدم
    const token = generateToken(testUser._id, testUser.role);

    console.log('\n========================================');
    console.log('🔑 Your test token (copy this to Thunder Client):');
    console.log('========================================');
    console.log(token);
    console.log('========================================\n');

    console.log('👉 استخدمه بـ Header هيك:');
    console.log(`Authorization: Bearer ${token}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

run();