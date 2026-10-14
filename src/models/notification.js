// src/models/notification.js
const mongoose = require('mongoose');
const { NOTIFICATION_TYPE } = require('../constants/discovery.constants');

// الإشعارات القديمة تُحذف تلقائياً بعد هذه المدة (TTL index)
const NOTIFICATION_TTL_DAYS = 90;

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // الفرونت يترجم النص حسب `type` و`data` (عربي/إنجليزي)،
    // و title/message نص إنجليزي احتياطي (fallback) فقط.
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // معرّفات للتنقل من الإشعار (campaignId, applicationId, reportId ...)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false, // يحافظ على data = {} بدل حذفه
  }
);

// ----------------------
// Indexes
// ----------------------
// قائمة إشعارات المستخدم + عدّاد غير المقروء
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
// حذف تلقائي بعد 90 يوماً
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 60 * 60 }
);

module.exports = mongoose.model('Notification', notificationSchema);