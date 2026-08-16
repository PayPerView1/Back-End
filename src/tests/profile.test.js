// tests/profile.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app'); // عدّل المسار حسب مكان app.js عندك
const User = require('../models/user'); // عدّل المسار حسب مكان الموديل عندك
const generateToken = require('../utils/generateTokens'); // عدّل المسار حسب مكان الملف عندك

let mongoServer;
let testUser;
let token;

// بتشتغل مرة وحدة قبل كل الاختبارات
beforeAll(async () => {
  // بننشئ قاعدة بيانات وهمية بالذاكرة (منعزلة كليًا عن Atlas الحقيقية)
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// بتشتغل مرة وحدة بعد ما كل الاختبارات تخلص
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// بتشتغل قبل كل اختبار (test) لحاله - عشان كل اختبار يبلش ببيانات نظيفة
beforeEach(async () => {
  await User.deleteMany({}); // بنفضي قاعدة البيانات الوهمية

  // بننشئ مستخدم تجريبي مباشرة (بدون ما نمر على authController تبع زميلك)
  testUser = await User.create({
    fullName: 'Test User',
    email: 'testuser@example.com',
    password: 'hashedPassword123', // هون افتراضي، مش لازم يكون hash حقيقي لأنو ما رح نسجل دخول فعليًا
    role: 'CLIPPER',
    country: 'PS',
    phoneNumber: '',
    city: '',
  });

  // بنولد توكن صحيح يدويًا، بنفس الآلية يلي authController رح يستخدمها
  token = generateToken(testUser._id, testUser.role);
});

// ============================================
// اختبارات GET /api/profile
// ============================================
describe('GET /api/profile', () => {
  it('لازم يرجع بيانات المستخدم لو التوكن صحيح', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('testuser@example.com');
    expect(res.body.user.password).toBeUndefined(); // تأكيد إنو الباسورد ما بيترجع
  });

  it('لازم يرجع 401 لو مافي توكن إطلاقًا', async () => {
    const res = await request(app).get('/api/profile');

    expect(res.statusCode).toBe(401);
  });

  it('لازم يرجع 401 لو التوكن غلط', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// اختبارات PUT /api/profile - تحديث ناجح
// ============================================
describe('PUT /api/profile - تحديث صحيح', () => {
  it('لازم يعدل الاسم بنجاح', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ahmad Khalil' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.fullName).toBe('Ahmad Khalil');
  });

  it('لازم يعدل رقم الهاتف والدولة مع بعض بنجاح', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'JO', phoneNumber: '791234567' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.country).toBe('JO');
    expect(res.body.user.phoneNumber).toBe('791234567');
  });

  it('لازم يقبل اسم فيه شرطة أو نقطة أو فاصلة عليا', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: "Jean-Paul O'Brien" });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.fullName).toBe("Jean-Paul O'Brien");
  });
});

// ============================================
// اختبارات PUT /api/profile - حالات الخطأ (Validation)
// ============================================
describe('PUT /api/profile - حالات الخطأ', () => {
  it('لازم يرفض اسم فيه أرقام', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ahmad123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e) => e.field === 'fullName')).toBe(true);
  });

  it('لازم يرفض دولة مش موجودة بالقائمة', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'XX' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'country')).toBe(true);
  });

  it('لازم يرفض رقم هاتف غلط لدولة محددة', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'PS', phoneNumber: '123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
  });

  it('لازم يرفض رقم هاتف بدون تحديد دولة بنفس الطلب', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '599123456' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
  });

  it('لازم يرفض رابط صورة غير صحيح', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePicture: 'not-a-valid-url' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'profilePicture')).toBe(true);
  });

  it('لازم يرفض التعديل بدون توكن', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ fullName: 'Ahmad' });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// اختبارات PUT /api/profile - رفع صورة (Image Upload)
// ============================================
describe('PUT /api/profile - رفع صورة', () => {
  it('لازم يرفض ملف مش صورة (نوع غير مسموح)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('profilePicture', Buffer.from('fake text content'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect(res.statusCode).toBe(400);
  });

  it('لازم يقبل صورة بصيغة مسموحة ويحفظ مسارها', async () => {
    // بنبني صورة PNG وهمية بسيطة بالذاكرة (1x1 بكسل شفاف) عشان ما نعتمد على ملف خارجي
    const fakePngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('profilePicture', fakePngBuffer, {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.profilePicture).toMatch(/^\/uploads\/profile-pictures\//);
  });
});