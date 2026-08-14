const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // يمنع إرجاع الباسورد في الاستعلامات العادية
    },
    role: {
      type: String,
      enum: ['BRAND', 'CLIPPER', 'ADMIN'],
      default: 'CLIPPER',
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

// 1. تشفير كلمة المرور قبل الحفظ أوتوماتيكياً
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return; // تم تعديل السطر: إزالة next()
  
  // Complexity policy check: حرف كبير، حرف صغير، رقم، ورمز خاص
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(this.password)) {
    throw new Error(
      'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.'
    );
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // تم تعديل السطر: إزالة next() في النهاية
});

// 2. دالة مقارنة كلمة المرور عند تسجيل الدخول
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 3. دالة إنشاء رمز تفعيل الإيميل (مشفّر وله تاريخ انتهاء)
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // تنتهي صلاحيته بعد 24 ساعة
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken; // نرجع الرمز غير المشفّر لإرساله عبر الإيميل
};

module.exports = mongoose.model('User', userSchema);