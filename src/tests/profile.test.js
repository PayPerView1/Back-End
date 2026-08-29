// tests/profile.test.js
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/user');
const generateToken = require('../utils/generateTokens');

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
// اختبارات GET /api/v1/profile
// ============================================
describe('GET /api/v1/profile', () => {
  it('لازم يرجع بيانات المستخدم لو التوكن صحيح', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('testuser@example.com');
    expect(res.body.user.password).toBeUndefined(); // تأكيد إنو الباسورد ما بيترجع
  });

  it('لازم يرجع 401 لو مافي توكن إطلاقًا', async () => {
    const res = await request(app).get('/api/v1/profile');

    expect(res.statusCode).toBe(401);
  });

  it('لازم يرجع 401 لو التوكن غلط', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// اختبارات PUT /api/v1/profile - تحديث ناجح
// ============================================
describe('PUT /api/v1/profile - تحديث صحيح', () => {
  it('لازم يعدل الاسم بنجاح', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ahmad Khalil' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.fullName).toBe('Ahmad Khalil');
  });

  it('لازم يعدل رقم الهاتف مع مقدمة الدولة بنجاح', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneCountryCode: '+962', phoneNumber: '791234567' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.phoneCountryCode).toBe('+962');
    expect(res.body.user.phoneNumber).toBe('791234567');
  });

  it('لازم يعدل الدولة (بلد السكن) بشكل مستقل عن الهاتف', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'JO' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.country).toBe('JO');
  });

  it('لازم يعدل تاريخ الميلاد بنجاح', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateOfBirth: '1998-05-20' });

    expect(res.statusCode).toBe(200);
    expect(new Date(res.body.user.dateOfBirth).toISOString().slice(0, 10)).toBe('1998-05-20');
  });

  it('لازم يعدل البايو بنجاح', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'مطور Backend شغوف بالتعلم المستمر.' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.bio).toBe('مطور Backend شغوف بالتعلم المستمر.');
  });

  it('لازم يقبل اسم فيه شرطة أو نقطة أو فاصلة عليا', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: "Jean-Paul O'Brien" });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.fullName).toBe("Jean-Paul O'Brien");
  });
});

// ============================================
// اختبارات PUT /api/v1/profile - حالات الخطأ (Validation)
// ============================================
describe('PUT /api/v1/profile - حالات الخطأ', () => {
  it('لازم يرفض اسم فيه أرقام', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ahmad123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e) => e.field === 'fullName')).toBe(true);
  });

  it('لازم يرفض دولة مش موجودة بالقائمة', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'XX' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'country')).toBe(true);
  });

  it('لازم يرفض مقدمة دولة (prefix) بصيغة غلط', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneCountryCode: '970', phoneNumber: '599123456' }); // بدون علامة +

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'phoneCountryCode')).toBe(true);
  });

  it('لازم يرفض رقم هاتف غلط لمقدمة دولة محددة', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneCountryCode: '+970', phoneNumber: '123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
  });

  it('لازم يرفض رقم هاتف بدون تحديد مقدمة الدولة بنفس الطلب', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '599123456' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
  });

  it('لازم يرفض تاريخ ميلاد بالمستقبل', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateOfBirth: futureDate.toISOString().slice(0, 10) });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'dateOfBirth')).toBe(true);
  });

  it('لازم يرفض عمر أقل من 13 سنة', async () => {
    const today = new Date();
    const tooYoungDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());

    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateOfBirth: tooYoungDate.toISOString().slice(0, 10) });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'dateOfBirth')).toBe(true);
  });

  it('لازم يرفض تاريخ ميلاد بصيغة غير صحيحة', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateOfBirth: 'not-a-date' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'dateOfBirth')).toBe(true);
  });

  it('لازم يرفض بايو أطول من 300 حرف', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(301) });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'bio')).toBe(true);
  });

  it('لازم يرفض رابط صورة غير صحيح', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePicture: 'not-a-valid-url' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'profilePicture')).toBe(true);
  });

  it('لازم يرفض التعديل بدون توكن', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .send({ fullName: 'Ahmad' });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================
// اختبارات PUT /api/v1/profile - رفع صورة (Image Upload)
// ============================================
describe('PUT /api/v1/profile - رفع صورة', () => {
  it('لازم يرفض ملف مش صورة (نوع غير مسموح)', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
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
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .attach('profilePicture', fakePngBuffer, {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.profilePicture).toMatch(/^\/uploads\/profile-pictures\//);
  });
});

// ============================================
// اختبارات PUT /api/v1/profile - الاهتمامات (Interests)
// ============================================
describe('PUT /api/v1/profile - الاهتمامات', () => {
  it('لازم يقبل مصفوفة فاضية (المستخدم بده يشيل كل اهتماماته)', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: [] });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.interests).toEqual([]);
  });

  it('لازم يقبل اهتمام وحد', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: ['TECHNOLOGY'] });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.interests).toEqual(['TECHNOLOGY']);
  });

  it('لازم يقبل أكتر من اهتمام مع بعض', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: ['TECHNOLOGY', 'HEALTH', 'FINANCE'] });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.interests).toEqual(['TECHNOLOGY', 'HEALTH', 'FINANCE']);
  });

  it('لازم يقبل كل الاهتمامات الستة مع بعض', async () => {
    const allInterests = [
      'LIFESTYLE',
      'TECHNOLOGY',
      'EDUCATION',
      'ENTERTAINMENT',
      'FINANCE',
      'HEALTH',
    ];

    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: allInterests });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.interests).toEqual(allInterests);
  });

  it('لازم يرفض قيمة اهتمام مش موجودة بالقائمة المسموحة', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: ['SPORTS'] }); // مش من القيم الستة المسموحة

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'interests')).toBe(true);
  });

  it('لازم يرفض لو interests مش مصفوفة أصلاً', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: 'TECHNOLOGY' }); // نص بدل مصفوفة

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'interests')).toBe(true);
  });

  it('لازم يستبدل المصفوفة بالكامل، مش يضيف عليها', async () => {
    // أول تحديث - نحط اهتمامين
    await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: ['TECHNOLOGY', 'HEALTH'] });

    // ثاني تحديث - نبعت اهتمام وحد بس
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ interests: ['FINANCE'] });

    expect(res.statusCode).toBe(200);
    // لازم يكون بس FINANCE، مش تراكم مع القديم
    expect(res.body.user.interests).toEqual(['FINANCE']);
  });
});

// ============================================
// اختبارات PUT /api/v1/profile - اسم المستخدم (Username)
// ============================================
describe('PUT /api/v1/profile - اسم المستخدم', () => {
  it('لازم يقبل username صحيح وفريد', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ahmad_khalil99' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe('ahmad_khalil99');
  });

  it('لازم يحفظ username بحروف صغيرة دايمًا (lowercase)', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'AhmadKhalil' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe('ahmadkhalil');
  });

  it('لازم يرفض username أقصر من 3 أحرف', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ab' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'username')).toBe(true);
  });

  it('لازم يرفض username فيه رموز أو مسافات غير مسموحة', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ahmad khalil!' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'username')).toBe(true);
  });

  it('لازم يرفض username مكرر مستخدم من شخص تاني', async () => {
    // بننشئ مستخدم تاني وناخدله username
    await User.create({
      fullName: 'Second User',
      email: 'second@example.com',
      password: 'hashedPassword123',
      role: 'CLIPPER',
      username: 'takenname',
    });

    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'takenname' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'username')).toBe(true);
  });

  it('لازم يسمح للمستخدم يحدث بياناته بنفس الـ username تبعه (بدون ما يعتبره تكرار)', async () => {
    // أول تحديث - نحط username
    await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'myusername' });

    // ثاني تحديث - نبعت نفس الـ username مع حقل تاني
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'myusername', bio: 'تحديث ثاني' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe('myusername');
  });

  it('لازم يسمح لأكتر من مستخدم يبعتوا username فاضي ("") بدون أي تعارض', async () => {
    // بننشئ مستخدم تاني، وبنبعتله هو كمان username فاضي
    const secondUser = await User.create({
      fullName: 'Second User',
      email: 'second-empty@example.com',
      password: 'hashedPassword123',
      role: 'CLIPPER',
    });
    const secondToken = generateToken(secondUser._id, secondUser.role);

    // المستخدم الأول يبعت username فاضي
    const res1 = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: '' });

    // المستخدم الثاني يبعت username فاضي كمان بنفس اللحظة تقريبًا
    const res2 = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ username: '' });

    // الاثنين لازم ينجحوا، بدون أي تعارض unique
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
  });

  it('لازم يشيل الـ username فعليًا (undefined) لو انبعت فاضي، مش يخزنه كنص فاضي', async () => {
    // أول شي نحط username حقيقي
    await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'willberemoved' });

    // بعدين نبعته فاضي
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: '' });

    expect(res.statusCode).toBe(200);
    // لازم يكون undefined فعليًا (الحقل غايب)، مش نص فاضي ""
    expect(res.body.user.username).toBeUndefined();
  });
});