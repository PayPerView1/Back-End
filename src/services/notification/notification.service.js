// src/services/notification/notification.service.js
// ============================================================
// العقد المشترك بين الشخصين. قاعدتان مهمتان:
//  1) دوال الإرسال (notifyUser / notifyMany / notifyAdmins / createManyNotifications)
//     لا ترمي أخطاء أبداً — فشل إشعار لا يجب أن يفشّل البلاغ أو التقديم.
//  2) استدعِها **بعد** commit للـ transaction وليس داخلها.
// ============================================================
const Notification = require('../../models/notification');
const User = require('../../models/user');
const { AppError } = require('../../utils/errors');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');

const logError = (context, error) =>
  console.error(`[notification.service] ${context}: ${error.message}`);

// ينفّذ دالة البريد بدون انتظارها، ويبتلع أخطاءها (sendEmail يرمي عند الفشل)
const fireAndForget = (fn, context) => {
  if (typeof fn !== 'function') return;
  Promise.resolve()
    .then(fn)
    .catch((error) => logError(context, error));
};

// ----------------------
// إرسال
// ----------------------

/**
 * إشعار داخلي لمستخدم + بريد اختياري (لا يُنتظر).
 *
 * @param {string|ObjectId} userId
 * @param {{ type: string, title: string, message: string, data?: Object }} payload
 *        استعمل buildNotification(...) من notification.templates.js
 * @param {Function} [emailFn]  مثال: () => sendNewApplicantEmail(advertiser, {...})
 * @returns {Promise<Object|null>} الإشعار المحفوظ، أو null إذا فشل الحفظ
 */
async function notifyUser(userId, payload, emailFn) {
  let notification = null;

  try {
    notification = await Notification.create({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data || {},
    });
  } catch (error) {
    logError('notifyUser (in-app)', error);
  }

  fireAndForget(emailFn, 'notifyUser (email)');
  return notification;
}

/**
 * يحفظ عدة إشعارات دفعة واحدة (كل عنصر قد يختلف بـ data، مثل favoriteId).
 * @param {Array<{ userId, type, title, message, data? }>} docs
 * @returns {Promise<number>} عدد ما حُفظ
 */
async function createManyNotifications(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return 0;

  try {
    const inserted = await Notification.insertMany(
      docs.map((d) => ({
        userId: d.userId,
        type: d.type,
        title: d.title,
        message: d.message,
        data: d.data || {},
      })),
      { ordered: false }
    );
    return inserted.length;
  } catch (error) {
    logError('createManyNotifications', error);
    return 0;
  }
}

/**
 * نفس الإشعار لعدة مستخدمين.
 * @param {Array<string|ObjectId>} userIds
 * @param {{ type, title, message, data? }} payload
 */
async function notifyMany(userIds, payload) {
  const unique = [...new Set((userIds || []).map(String))];
  return createManyNotifications(unique.map((userId) => ({ userId, ...payload })));
}

/**
 * إشعار داخلي لكل حسابات ADMIN + بريد واحد اختياري (إلى MODERATION_TEAM_EMAIL مثلاً).
 * @param {{ type, title, message, data? }} payload
 * @param {Function} [emailFn] يُستدعى مرة واحدة (وليس لكل أدمن)
 */
async function notifyAdmins(payload, emailFn) {
  let count = 0;

  try {
    const admins = await User.find({ role: 'ADMIN' }).select('_id').lean();
    count = await notifyMany(
      admins.map((a) => a._id),
      payload
    );
  } catch (error) {
    logError('notifyAdmins', error);
  }

  fireAndForget(emailFn, 'notifyAdmins (email)');
  return count;
}

// ----------------------
// قراءة (لـ notification.controller)
// ----------------------

const toDto = (n) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  message: n.message,
  data: n.data || {},
  isRead: n.isRead,
  createdAt: n.createdAt,
});

/**
 * @param {string|ObjectId} userId
 * @param {{ unread?: boolean|string, page?, perPage?, limit? }} query
 * @returns {Promise<{ items: Object[], pagination: Object }>}
 */
async function getUserNotifications(userId, query = {}) {
  const { page, perPage, skip, limit } = parsePagination(query);

  const filter = { userId };
  if (query.unread === true || query.unread === 'true') {
    filter.isRead = false;
  }

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);

  return { items: items.map(toDto), pagination: buildPageMeta(total, page, perPage) };
}

async function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}

async function markAsRead(notificationId, userId) {
  // الشرط userId يمنع قراءة/تعديل إشعار مستخدم آخر (النتيجة 404 وليس 403)
  const notification = await Notification.findOne({ _id: notificationId, userId });

  if (!notification) {
    throw new AppError('Notification not found', 'NOT_FOUND');
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return {
    id: notification._id,
    isRead: true,
    readAt: notification.readAt,
  };
}

async function markAllAsRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { updated: result.modifiedCount };
}

module.exports = {
  notifyUser,
  notifyMany,
  notifyAdmins,
  createManyNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};