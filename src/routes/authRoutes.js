const express = require('express');
const passport = require('passport');
const generateToken = require('../utils/generateTokens');
const router = express.Router();
const {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  updateInterests,
  logout,
} = require('../controllers/authController');

const uploadMiddleware = require('../middlewares/uploadMiddleware');
const { updateProfileRules, validate } = require('../validators/profileValidator');

// 1. استدعاء الـ Middleware للحماية
const { protect } = require('../middlewares/authMiddleware');

// Public Routes (مسارات عامة)
router.post(
  '/register',
  uploadMiddleware,   // يتعامل مع رفع الملف إن وجد (req.file)
  updateProfileRules, // يتأكد من صحة رقم الهاتف والدولة والمدينة
  validate,           // يرجع أخطاء الـ Validation إن وجدت
  register
);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
// 👈 مسار GET لعرض صفحة HTML لإعادة تعيين كلمة المرور
router.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تغيير كلمة المرور</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f9; margin: 0; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
        h2 { color: #333; margin-bottom: 20px; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; font-size: 14px; }
        button { width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold; }
        button:hover { background: #218838; }
        #msg { margin-top: 15px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>إعادة تعيين كلمة المرور</h2>
        <form id="resetForm">
          <input type="password" id="password" placeholder="أدخل كلمة المرور الجديدة" required />
          <input type="password" id="confirmPassword" placeholder="تأكيد كلمة المرور الجديدة" required />
          <button type="submit">حفظ كلمة المرور الجديدة</button>
        </form>
        <p id="msg"></p>
      </div>

      <script>
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const password = document.getElementById('password').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const msgEl = document.getElementById('msg');

          if (password !== confirmPassword) {
            msgEl.style.color = 'red';
            msgEl.innerText = 'كلمتا المرور غير متطابقتين!';
            return;
          }

          msgEl.style.color = 'black';
          msgEl.innerText = 'جاري الحفظ...';

          try {
            const res = await fetch('/api/v1/auth/reset-password/${token}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password, confirmPassword })
            });
            const data = await res.json();
            
            if (data.success) {
              msgEl.style.color = 'green';
              msgEl.innerText = 'تم تحديث كلمة المرور بنجاح! يمكنك إغلاق هذه الصفحة الآن.';
              document.getElementById('resetForm').reset();
            } else {
              msgEl.style.color = 'red';
              msgEl.innerText = data.message || 'حدث خطأ أو انتهت صلاحية الرابط.';
            }
          } catch (err) {
            msgEl.style.color = 'red';
            msgEl.innerText = 'تعذر الاتصال بالسيرفر.';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// مسار POST لمعالجة تحديث كلمة المرور فعلياً
router.post('/reset-password/:token', resetPassword);

// Protected Routes (مسارات تتطلب تسجيل الدخول وتوفير الـ JWT)
router.patch('/change-password', protect, changePassword);
router.patch('/interests', protect, updateInterests);
router.post('/logout', protect, logout);

// 1. مسار توجيه المستخدم لصفحة Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. مسار العودة بعد نجاح تسجيل الدخول من Google
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`}),
  (req, res) => {
    // توليد الـ JWT Token الخاص بنظامك
    const token = generateToken(req.user._id, req.user.role);

    // إرجاع النتيجة فوراً للمتصفح لاختبار السيرفر
    res.redirect(
  `${process.env.FRONTEND_URL}/dashboard?token=${token}`
);
  }
);
module.exports = router;