// src/services/material/materialDownloadLog.service.js
const mongoose = require('mongoose');
const DownloadLog = require('../../models/downloadLog');
const Campaign = require('../../models/campaign');
const User = require('../../models/user');
const { AppError } = require('../../utils/errors');
const { DOWNLOAD_STATUS } = require('../../constants/submission.constants');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const { notifyDownloadResult } = require('../submission/submissionNotifications.service');

const CLIENT_REPORTED = 'CLIENT_REPORTED';

/**
 * A5.6: المبدع يبلّغ نتيجة التنزيل (مرة واحدة).
 *  - COMPLETED: فقط من STARTED. FAILED: من REQUESTED أو STARTED.
 *  - سجل مبدع آخر => NOT_FOUND. سجل أُبلغ/فشل مسبقاً (حتى من السيرفر) => CONFLICT.
 */
const reportDownloadResult = async (logId, creatorId, { status, reason } = {}) => {
  if (![DOWNLOAD_STATUS.COMPLETED, DOWNLOAD_STATUS.FAILED].includes(status)) {
    throw new AppError('Invalid status', 'VALIDATION_ERROR');
  }

  const isCompleted = status === DOWNLOAD_STATUS.COMPLETED;
  const allowedFrom = isCompleted
    ? [DOWNLOAD_STATUS.STARTED]
    : [DOWNLOAD_STATUS.REQUESTED, DOWNLOAD_STATUS.STARTED];
  const set = isCompleted
    ? { status, completedAt: new Date(), failureReason: null }
    : { status, failureReason: String(reason || '').trim().slice(0, 200) || CLIENT_REPORTED };

  const log = await DownloadLog.findOneAndUpdate(
    { _id: logId, creatorId, status: { $in: allowedFrom } },
    { $set: set },
    { returnDocument: 'after' }
  ).lean();

  if (!log) {
    const exists = await DownloadLog.exists({ _id: logId, creatorId });
    if (!exists) throw new AppError('Download not found', 'NOT_FOUND');
    throw new AppError('This download cannot be reported', 'CONFLICT');
  }

  // الإشعار بعد الكتابة (notifyDownloadResult لا ترمي أبداً)
  const campaign = await Campaign.findById(log.campaignId).select('name').lean();
  if (campaign) await notifyDownloadResult(log, campaign, status);

  return { id: log._id, status: log.status };
};

/** A5.7: من نزّل مواد الحملة (تجميع حسب المبدع). التنزيلات الفعلية فقط */
const getCampaignDownloads = async (campaignId, filters = {}) => {
  const { page, perPage, skip } = parsePagination(filters, { defaultPerPage: 20, maxPerPage: 50 });

  const [result] = await DownloadLog.aggregate([
    {
      $match: {
        campaignId: new mongoose.Types.ObjectId(String(campaignId)),
        consumedAt: { $ne: null },
        status: { $ne: DOWNLOAD_STATUS.FAILED },
      },
    },
    { $group: { _id: '$creatorId', totalDownloads: { $sum: 1 }, lastDownloadedAt: { $max: '$consumedAt' } } },
    { $sort: { lastDownloadedAt: -1, _id: 1 } },
    { $facet: { items: [{ $skip: skip }, { $limit: perPage }], total: [{ $count: 'n' }] } },
  ]);

  const rows = (result && result.items) || [];
  const total = (result && result.total[0] && result.total[0].n) || 0;

  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('fullName profilePicture')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const data = rows.map((r) => {
    const u = byId.get(String(r._id));
    return {
      creator: { id: r._id, fullName: (u && u.fullName) || null, profilePicture: (u && u.profilePicture) || null },
      totalDownloads: r.totalDownloads,
      lastDownloadedAt: r.lastDownloadedAt,
    };
  });

  return { data, pagination: buildPageMeta(total, page, perPage) };
};

module.exports = { reportDownloadResult, getCampaignDownloads };