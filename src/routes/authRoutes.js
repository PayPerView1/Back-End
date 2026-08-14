const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
} = require('../controllers/authController');

// 1. استدعاء الـ Middleware للحماية
const { protect } = require('../middlewares/authMiddleware');

// Public Routes (مسارات عامة)
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// 👈 [جديد] مسار GET لعرض صفحة HTML لإعادة تعيين كلمة المرور مباشرة من المتصفح
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
          <input type="password" id="password" placeholder="أدخل كلمة المرور الجديدة" required minlength="6" />
          <button type="submit">حفظ كلمة المرور الجديدة</button>
        </form>
        <p id="msg"></p>
      </div>

      <script>
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const password = document.getElementById('password').value;
          const msgEl = document.getElementById('msg');
          msgEl.style.color = 'black';
          msgEl.innerText = 'جاري الحفظ...';

          try {
            const res = await fetch('/api/v1/auth/reset-password/${token}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password })
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
router.post('/logout', protect, logout);

module.exports = router;