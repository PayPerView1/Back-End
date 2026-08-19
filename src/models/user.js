// src/models/User.js
const mongoose = require('mongoose');

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
    // R0.04 & R0.01: المعلومات الأساسية
    fullName: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true, // يضمن عدم تكرار الإيميل R0.01
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false, // لا ينزل الباسورد تلقائياً في الاستعلامات لحماية الأمان
    },

    // R0.03: نوع الحساب (Brand / Clipper / Admin)
    role: {
      type: String,
      enum: ['BRAND', 'CLIPPER', 'ADMIN'],
      default: 'CLIPPER',
      required: true,
    },

    // R0.04: تفاصيل الملف الشخصي
    profilePicture: {
      type: String,
      default: 'default-avatar.png',
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },

    // الاهتمامات - المستخدم فيه يختار وحدة، أكتر من وحدة، كلهم، أو ولا وحدة
    interests: {
      type: [String],       // مصفوفة نصوص
      enum: INTEREST_OPTIONS, // كل عنصر بالمصفوفة لازم يكون من هالقيم بس
      default: [],           // افتراضيًا فاضية - المستخدم مش مجبر يختار شي
    },

    // R0.09: تفعيل الإيميل
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // R0.07: إعادة ضبط كلمة المرور
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true, // يضيف createdAt و updatedAt تلقائياً
  }
);

module.exports = mongoose.model('User', userSchema);
module.exports.INTEREST_OPTIONS = INTEREST_OPTIONS;