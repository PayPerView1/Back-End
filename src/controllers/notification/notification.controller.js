// src/routes/notification/notification.routes.js
const { sendError } = require('../../utils/errors');
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} = require('../../services/notification/notification.service');

const listNotifications = async (req, res) => {
  try {
    const result = await getUserNotifications(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    return sendError(res, error, 'notification.controller.listNotifications');
  }
};

const getUnreadCountHandler = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user._id);
    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    return sendError(res, error, 'notification.controller.getUnreadCount');
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const result = await markAsRead(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendError(res, error, 'notification.controller.markAsRead');
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await markAllAsRead(req.user._id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendError(res, error, 'notification.controller.markAllAsRead');
  }
};

module.exports = {
  listNotifications,
  getUnreadCountHandler,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
