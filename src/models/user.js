const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const INTEREST_OPTIONS = [
  'LIFESTYLE',    // نمط الحياة
  'TECHNOLOGY',   // التكنولوجيا
  'EDUCATION',    // التعليم
  'ENTERTAINMENT',// الترفيه
  'FINANCE',      // المالية
  'HEALTH',       // الصحة
];

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
      required: [
        function () {
          return !this.googleId;
        },
        'Please provide a password',
      ],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // يمنع إرجاع الباسورد في الاستعلامات العادية
    },
    googleId: {
      type: String,
      default: null,
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
    
    interests: {
      type: [String],       // مصفوفة نصوص
      enum: INTEREST_OPTIONS, // كل عنصر بالمصفوفة لازم يكون من هالقيم بس
      default: [],           // افتراضيًا فاضية - المستخدم مش مجبر يختار شي
    },

    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    
    // الحقول الاختيارية المعرفة للتسجيل والبروفايل
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    profilePicture: {
      type: String,
      default: '',
    }
  },
  { timestamps: true }
);

// تشفير كلمة المرور قبل الحفظ إذا تم تعديلها أو إضافتها
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// دالة مقارنة كلمة المرور عند تسجيل الدخول
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// دالة إنشاء رمز تفعيل الإيميل
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // تنتهي صلاحيته بعد 24 ساعة
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

module.exports = mongoose.model('User', userSchema);