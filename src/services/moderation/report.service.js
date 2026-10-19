// src/services/moderation/report.service.js
// ============================================================
// الجزء 1 (A-03): تقديم البلاغ + الإيقاف + تأكيد بلاغ الزائر.
// يأتي لاحقاً: getReports / getReportById / getReportStatistics / reviewReport.
//
// قواعد هذا الملف:
//  - الإيقاف + إنشاء البلاغ + سجل النشاط داخل transaction واحدة (withTransaction).
//  - الإشعارات والبريد بعد الـ commit فقط، ولا ترمي أخطاء (notification.service).
//  - داخل الـ transaction نكتب CampaignActivityLog مباشرة بالـ session
//    (logActivity يبتلع الأخطاء ولا يشارك في الـ session).
// ============================================================
const crypto = require('crypto');
const mongoose = require('mongoose');

const Campaign = require('../../models/campaign');
const Report = require('../../models/report');
const User = require('../../models/user');
const CampaignActivityLog = require('../../models/CampaignActivityLog');

const { AppError } = require('../../utils/errors');
const { CAMPAIGN_ACTION, CAMPAIGN_STATUS } = require('../../constants/campaign.constants');
const { NOTIFICATION_TYPE, REPORT_STATUS, REPORT_ACTION_TAKEN } = require('../../constants/discovery.constants');
const {
  isReportable,
  REPORTABLE_STATUSES,
} = require('../../utils/campaign/campaignVisibility.utils');

const { isCancellable } = require('../../utils/campaign/campaignStatus.utils');
const { releaseCampaignBudget } = require('../wallet/campaignBudget.service');

const { notifyUser, notifyAdmins } = require('../notification/notification.service');
const { buildNotification } = require('../notification/notification.templates');
const notificationEmails = require('../notification/notificationEmails');
const { notifyFavoritersCampaignUnavailable } = require('../creator/favoriteNotifications.service');
const VISITOR_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 ساعة
const SUSPENSION_REASON_REPORTED = 'REPORTED';

// ----------------------
// أدوات مساعدة
// ----------------------

/** HMAC لعنوان IP (لا نخزن IP خاماً). بدون IP_HASH_SECRET لا نخزّن شيئاً. */
const hashIp = (ip) => {
  if (!ip || !process.env.IP_HASH_SECRET) return null;
  return crypto.createHmac('sha256', process.env.IP_HASH_SECRET).update(String(ip)).digest('hex');
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** توكن التأكيد: الخام يُرسل بالبريد، ويُخزَّن hash فقط */
const generateConfirmationToken = () => {
  const token = crypto.randomBytes(32).toString('hex'); // 64 hex
  return {
    token,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + VISITOR_TOKEN_TTL_MS),
  };
};

const buildConfirmUrl = (token) => {
  const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!base) {
    throw new Error('FRONTEND_URL is not configured');
  }
  return `${base}/reports/confirm/${token}`;
};

// الحقول التي نحتاجها من الحملة في كل مسارات هذا الملف
const CAMPAIGN_FIELDS = 'name advertiserId status isArchived isSuspended';

// ----------------------
// الإيقاف (داخل transaction يملكها المستدعي)
// ----------------------

/**
 * يوقف الحملة بسبب بلاغ، **شرطياً وذرّياً**: لا يوقف حملة موقوفة أصلاً ولا ملغاة/مؤرشفة،
 * ويسجّل الأحداث في CampaignActivityLog بنفس الـ session.
 *
 * @returns {Promise<boolean>} true إذا كان هذا الإيقاف جديداً (لإرسال الإشعارات مرة واحدة)
 */
const suspendCampaignForReport = async (campaignId, { reportId, reason, performedBy }, session) => {
  const result = await Campaign.updateOne(
    {
      _id: campaignId,
      isSuspended: { $ne: true },
      status: { $in: REPORTABLE_STATUSES },
    },
    {
      $set: {
        isSuspended: true,
        suspensionReason: SUSPENSION_REASON_REPORTED,
        suspendedAt: new Date(),
      },
    },
    { session }
  );

  const newlySuspended = result.modifiedCount === 1;

  const logs = [
    {
      campaignId,
      action: CAMPAIGN_ACTION.REPORTED,
      performedBy: performedBy || null,
      metadata: { reportId, reason },
    },
  ];

  if (newlySuspended) {
    logs.push({
      campaignId,
      action: CAMPAIGN_ACTION.SUSPENDED,
      performedBy: null, // النظام
      metadata: { reportId, reason: SUSPENSION_REASON_REPORTED },
    });
  }

  await CampaignActivityLog.create(logs, { session, ordered: true });

  // Notify favoriters (only when newly suspended)
  if (newlySuspended) {
    try {
      await notifyFavoritersCampaignUnavailable(campaignId, campaign.name, 'NOT_AVAILABLE');
    } catch (error) {
      console.error(`[report.service] Failed to notify favoriters: ${error.message}`);
    }
  }

  return newlySuspended;
};

// ----------------------
// الإشعارات بعد بلاغ مؤكد (تُستدعى بعد الـ commit)
// ----------------------
const notifyAfterConfirmedReport = async ({ campaign, reportId, reason, newlySuspended }) => {
  try {
    // المعلن: فقط عند أول إيقاف (لا نزعجه ببلاغ إضافي على حملة موقوفة أصلاً)
    if (newlySuspended) {
      const advertiser = await User.findById(campaign.advertiserId).select('email fullName').lean();

      if (advertiser) {
        await notifyUser(
          advertiser._id,
          buildNotification(
            NOTIFICATION_TYPE.CAMPAIGN_REPORTED,
            { campaignName: campaign.name },
            { campaignId: campaign._id }
          ),
          () => notificationEmails.sendCampaignReportedEmail(advertiser, { campaignName: campaign.name })
        );
      }
    }

    // الأدمن: عن كل بلاغ مؤكد، حتى لو كانت الحملة موقوفة سابقاً (بلاغ جديد في قائمتهم)
    await notifyAdmins(
      buildNotification(
        NOTIFICATION_TYPE.REPORT_RECEIVED,
        { campaignName: campaign.name, reason },
        { reportId, campaignId: campaign._id }
      ),
      () =>
        notificationEmails.sendReportReceivedAdminEmail({
          campaignName: campaign.name,
          reason,
          reportId,
        })
    );
  } catch (error) {
    console.error(`[report.service] notifyAfterConfirmedReport failed: ${error.message}`);
  }
};

// ----------------------
// تقديم بلاغ — مستخدم مسجّل
// ----------------------
const submitUserReport = async (campaign, reporter, { reason, details }, ip) => {
  const session = await mongoose.startSession();
  let report;
  let newlySuspended = false;

  try {
    await session.withTransaction(async () => {
      const [created] = await Report.create(
        [
          {
            reporterId: reporter._id,
            reporterIpHash: hashIp(ip),
            campaignId: campaign._id,
            reason,
            details: details || '',
            isConfirmed: true,
          },
        ],
        { session }
      );
      report = created;

      newlySuspended = await suspendCampaignForReport(
        campaign._id,
        { reportId: report._id, reason, performedBy: reporter._id },
        session
      );
    });
  } catch (error) {
    // الحماية الحقيقية من التكرار (حتى مع الطلبات المتزامنة) هي الـ unique index
    if (error.code === 11000) {
      throw new AppError('You have already reported this campaign.', 'ALREADY_REPORTED');
    }
    throw error;
  } finally {
    session.endSession();
  }

  await notifyAfterConfirmedReport({ campaign, reportId: report._id, reason, newlySuspended });

  return {
    reportId: report._id,
    requiresEmailConfirmation: false,
    message: 'Your report has been received. The campaign will be reviewed.',
  };
};

// ----------------------
// تقديم بلاغ — زائر (بلا إيقاف قبل تأكيد البريد)
// ----------------------
const submitVisitorReport = async (campaign, { reason, details, email }, ip) => {
  const existing = await Report.findOne({
    campaignId: campaign._id,
    reporterEmail: email,
  });

  // بلاغ مؤكد سابق لنفس البريد
  if (existing && existing.isConfirmed) {
    throw new AppError('You have already reported this campaign.', 'ALREADY_REPORTED');
  }

  const { token, tokenHash, expiresAt } = generateConfirmationToken();
  let report;

  if (existing) {
    // بلاغ غير مؤكد (الزائر فقد البريد أو انتهى الرابط): نجدد التوكن ونعيد الإرسال
    existing.reason = reason;
    existing.details = details || '';
    existing.confirmationTokenHash = tokenHash;
    existing.confirmationExpiresAt = expiresAt;
    existing.reporterIpHash = hashIp(ip);
    await existing.save();
    report = existing;
  } else {
    try {
      report = await Report.create({
        reporterEmail: email,
        reporterIpHash: hashIp(ip),
        campaignId: campaign._id,
        reason,
        details: details || '',
        isConfirmed: false,
        confirmationTokenHash: tokenHash,
        confirmationExpiresAt: expiresAt,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('You have already reported this campaign.', 'ALREADY_REPORTED');
      }
      throw error;
    }
  }

  // إن فشل الإرسال نترك الخطأ يصعد (500): البلاغ محفوظ، وإعادة المحاولة تجدد التوكن وترسل من جديد
  await notificationEmails.sendReportConfirmationEmail(email, {
    campaignName: campaign.name,
    confirmUrl: buildConfirmUrl(token),
  });

  return {
    reportId: report._id,
    requiresEmailConfirmation: true,
    message: 'Please check your email to confirm your report.',
  };
};

// ----------------------
// POST /campaigns/:campaignId/report
// ----------------------
/**
 * @param {string} campaignId
 * @param {Object|null} reporter  req.user للمسجّل، أو null للزائر
 * @param {{ reason: string, details?: string, email?: string }} body
 * @param {string} ip  req.ip
 */
async function submitReport(campaignId, reporter, body = {}, ip) {
  const { email } = body;
  const isVisitor = !reporter;

  if (isVisitor && !email) {
    throw new AppError('Email is required to submit a report', 'VALIDATION_ERROR');
  }

  const campaign = await Campaign.findById(campaignId).select(CAMPAIGN_FIELDS).lean();

  if (!campaign || !isReportable(campaign)) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // المعلن لا يبلّغ عن حملته (مسجّلاً أو كزائر بنفس بريده)
  if (isVisitor) {
    const owner = await User.findById(campaign.advertiserId).select('email').lean();
    if (owner && owner.email === email) {
      throw new AppError('You cannot report your own campaign.', 'CANNOT_REPORT_OWN_CAMPAIGN');
    }
  } else if (String(campaign.advertiserId) === String(reporter._id)) {
    throw new AppError('You cannot report your own campaign.', 'CANNOT_REPORT_OWN_CAMPAIGN');
  }

  return isVisitor
    ? submitVisitorReport(campaign, body, ip)
    : submitUserReport(campaign, reporter, body, ip);
}

// ----------------------
// POST /reports/confirm
// ----------------------
/**
 * @param {string} token  التوكن الخام من رابط البريد (64 hex)
 */
async function confirmVisitorReport(token) {
  const invalid = () => new AppError('Invalid or expired confirmation link', 'INVALID_TOKEN');

  // الفلترة على حقل select:false تعمل (الـ select يؤثر على ما يُرجَع فقط)
  const report = await Report.findOne({
    confirmationTokenHash: sha256(String(token)),
    isConfirmed: false,
  });

  if (!report || !report.confirmationExpiresAt || report.confirmationExpiresAt < new Date()) {
    throw invalid();
  }

  const campaign = await Campaign.findById(report.campaignId).select(CAMPAIGN_FIELDS).lean();
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  const session = await mongoose.startSession();
  let newlySuspended = false;

  try {
    await session.withTransaction(async () => {
      // شرط isConfirmed:false يجعل الرابط لمرة واحدة حتى لو ضُغط مرتين بالتزامن
      const updated = await Report.findOneAndUpdate(
        { _id: report._id, isConfirmed: false },
        {
          $set: { isConfirmed: true },
          $unset: { confirmationTokenHash: '', confirmationExpiresAt: '' },
        },
        { session, returnDocument: 'after' }
      );

      if (!updated) {
        throw invalid();
      }

      newlySuspended = await suspendCampaignForReport(
        campaign._id,
        { reportId: report._id, reason: report.reason, performedBy: null },
        session
      );
    });
  } finally {
    session.endSession();
  }

  await notifyAfterConfirmedReport({
    campaign,
    reportId: report._id,
    reason: report.reason,
    newlySuspended,
  });

  return {
    reportId: report._id,
    message: 'Your report has been confirmed. The campaign will be reviewed.',
  };
}

// ----------------------
// List Reports (Admin)
// ----------------------
const getReports = async (filters = {}) => {
  const {
    status = 'PENDING',
    reason,
    campaignId,
    page = 1,
    perPage = 20,
  } = filters;

  const filter = { isConfirmed: true };

  if (status !== 'ALL') {
    filter.status = status;
  }

  if (reason) {
    filter.reason = reason;
  }

  if (campaignId) {
    filter.campaignId = campaignId;
  }

  const skip = (page - 1) * perPage;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .populate('campaignId', 'name status isSuspended advertiserId')
      .populate('reporterId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Report.countDocuments(filter),
  ]);

  // Get pending reports count for each campaign
  const campaignIds = [...new Set(reports.map(r => r.campaignId?._id).filter(Boolean))];
  const pendingCounts = await Report.aggregate([
    {
      $match: {
        campaignId: { $in: campaignIds },
        status: 'PENDING',
        isConfirmed: true,
      },
    },
    {
      $group: {
        _id: '$campaignId',
        count: { $sum: 1 },
      },
    },
  ]);

  const pendingMap = {};
  pendingCounts.forEach(p => {
    pendingMap[p._id.toString()] = p.count;
  });

  const enrichedReports = reports.map(report => ({
    ...report,
    pendingReportsForCampaign: report.campaignId?._id
      ? pendingMap[report.campaignId._id.toString()] || 0
      : 0,
  }));

  return {
    reports: enrichedReports,
    pagination: {
      page: parseInt(page),
      perPage: parseInt(perPage),
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

// ----------------------
// Report Statistics (Admin)
// ----------------------
const getReportStatistics = async () => {
  const [stats, byReason] = await Promise.all([
    Report.aggregate([
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          pendingReports: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
          },
          resolvedReports: {
            $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] },
          },
          dismissedReports: {
            $sum: { $cond: [{ $eq: ['$status', 'DISMISSED'] }, 1, 0] },
          },
        },
      },
    ]),
    Report.aggregate([
      {
        $match: { isConfirmed: true },
      },
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const suspendedCampaigns = await Campaign.countDocuments({ isSuspended: true });

  // Calculate average review time
  const reviewedReports = await Report.find({
    status: { $in: ['RESOLVED', 'DISMISSED'] },
    reviewedAt: { $exists: true },
  }).select('createdAt reviewedAt');

  let averageReviewTimeHours = null;
  if (reviewedReports.length > 0) {
    const totalHours = reviewedReports.reduce((sum, report) => {
      const diffMs = new Date(report.reviewedAt) - new Date(report.createdAt);
      return sum + diffMs / (1000 * 60 * 60);
    }, 0);
    averageReviewTimeHours = totalHours / reviewedReports.length;
  }

  const reasonMap = {};
  byReason.forEach(r => {
    reasonMap[r._id] = r.count;
  });

  return {
    totalReports: stats[0]?.totalReports || 0,
    pendingReports: stats[0]?.pendingReports || 0,
    resolvedReports: stats[0]?.resolvedReports || 0,
    dismissedReports: stats[0]?.dismissedReports || 0,
    suspendedCampaigns,
    averageReviewTimeHours: averageReviewTimeHours
      ? parseFloat(averageReviewTimeHours.toFixed(1))
      : null,
    byReason: reasonMap,
  };
};

// ----------------------
// Get Single Report (Admin)
// ----------------------
const getReportById = async (id) => {
  const report = await Report.findById(id)
    .populate('campaignId', 'name status isSuspended advertiserId remainingBudget totalBudget brief materials')
    .populate('reporterId', 'fullName email')
    .lean();

  if (!report) {
    throw new AppError('Report not found', 'NOT_FOUND');
  }

  // Get other reports on the same campaign
  const otherReports = await Report.find({
    campaignId: report.campaignId,
    _id: { $ne: report._id },
  })
    .select('reason details status createdAt')
    .lean();

  return {
    ...report,
    reportId: report._id,
    otherReports,
  };
};

// ----------------------
// Review Report (Admin)
// ----------------------
const reviewReport = async (reportId, adminId, { action, note }) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const report = await Report.findById(reportId).session(session);

      if (!report) {
        throw new AppError('Report not found', 'NOT_FOUND');
      }

      if (report.status !== REPORT_STATUS.PENDING) {
        throw new AppError('This report has already been reviewed', 'REPORT_ALREADY_REVIEWED');
      }

      const campaign = await Campaign.findById(report.campaignId).session(session);

      if (!campaign) {
        throw new AppError('Campaign not found', 'NOT_FOUND');
      }

      if (action === 'CONFIRM_VIOLATION') {
        if (!note || !note.trim()) {
          throw new AppError('A note is required when confirming a violation', 'VALIDATION_ERROR');
        }

        // Check if campaign can be cancelled
        if (!isCancellable(campaign.status)) {
          throw new AppError('This campaign cannot be cancelled', 'VALIDATION_ERROR');
        }

        // Cancel the campaign
        campaign.status = CAMPAIGN_STATUS.CANCELLED;
        campaign.isSuspended = true;
        await campaign.save({ session });

        // Release budget
        const budgetReleased = await releaseCampaignBudget(campaign._id, session);

        // Update all pending reports on this campaign to RESOLVED
        await Report.updateMany(
          {
            campaignId: campaign._id,
            status: REPORT_STATUS.PENDING,
          },
          {
            $set: {
              status: REPORT_STATUS.RESOLVED,
              actionTaken: REPORT_ACTION_TAKEN.CAMPAIGN_CANCELLED,
              reviewedBy: adminId,
              reviewedAt: new Date(),
            },
          },
          { session }
        );

        // Log activity
        await CampaignActivityLog.create(
          [
            {
              campaignId: campaign._id,
              action: CAMPAIGN_ACTION.CANCELLED_BY_REPORT,
              performedBy: adminId,
              metadata: {
                reportId,
                note,
                releasedAmount: budgetReleased?.amount || 0,
              },
            },
          ],
          { session }
        );

        // Notify favoriters
        try {
          await notifyFavoritersCampaignUnavailable(campaign._id, campaign.name, 'NOT_AVAILABLE');
        } catch (error) {
          console.error(`[report.service] Failed to notify favoriters: ${error.message}`);
        }

        // Notify advertiser
        const advertiser = await User.findById(campaign.advertiserId).session(session);
        if (advertiser) {
          await notifyUser(
            advertiser._id,
            buildNotification(
              NOTIFICATION_TYPE.CAMPAIGN_CANCELLED_BY_REPORT,
              { campaignName: campaign.name, note },
              { campaignId: campaign._id }
            ),
            () => notificationEmails.sendCampaignCancelledByReportEmail(advertiser, {
              campaignName: campaign.name,
              note
            })
          );
        }

        // Notify reporters
        const reporters = await Report.find({
          campaignId: campaign._id,
          status: REPORT_STATUS.RESOLVED,
          reporterId: { $ne: null },
        })
          .populate('reporterId')
          .session(session);

        for (const r of reporters) {
          if (r.reporterId) {
            await notifyUser(
              r.reporterId._id,
              buildNotification(
                NOTIFICATION_TYPE.REPORT_RESOLVED,
                { campaignName: campaign.name, outcome: 'CONFIRMED' },
                { reportId: r._id, campaignId: campaign._id }
              ),
              () => notificationEmails.sendReportOutcomeEmail(r.reporterId.email, {
                campaignName: campaign.name,
                outcome: 'CONFIRMED'
              })
            );
          }
        }

        return {
          reportId: report._id,
          status: REPORT_STATUS.RESOLVED,
          actionTaken: REPORT_ACTION_TAKEN.CAMPAIGN_CANCELLED,
          resolvedReportsCount: reporters.length,
          campaign: {
            id: campaign._id,
            status: campaign.status,
            isSuspended: campaign.isSuspended,
          },
          budgetReleased: budgetReleased ? {
            amount: budgetReleased.amount,
            walletBalanceAfter: budgetReleased.walletBalanceAfter,
          } : null,
        };
      } else if (action === 'DISMISS') {
        // Check if there are other pending reports on this campaign
        const otherPendingReports = await Report.countDocuments({
          campaignId: campaign._id,
          status: REPORT_STATUS.PENDING,
          _id: { $ne: reportId },
        }).session(session);

        const suspensionLifted = otherPendingReports === 0;

        if (suspensionLifted) {
          campaign.isSuspended = false;
          campaign.suspensionReason = null;
          campaign.suspendedAt = null;
          await campaign.save({ session });

          await CampaignActivityLog.create(
            [
              {
                campaignId: campaign._id,
                action: CAMPAIGN_ACTION.SUSPENSION_LIFTED,
                performedBy: adminId,
                metadata: { reportId },
              },
            ],
            { session }
          );
        }

        // Update this report
        report.status = REPORT_STATUS.DISMISSED;
        report.reviewedBy = adminId;
        report.reviewedAt = new Date();
        await report.save({ session });

        // Notify advertiser
        const advertiser = await User.findById(campaign.advertiserId).session(session);
        if (advertiser) {
          await notifyUser(
            advertiser._id,
            buildNotification(
              NOTIFICATION_TYPE.CAMPAIGN_SUSPENSION_LIFTED,
              { campaignName: campaign.name },
              { campaignId: campaign._id }
            ),
            () => notificationEmails.sendCampaignSuspensionLiftedEmail(advertiser, {
              campaignName: campaign.name
            })
          );
        }

        return {
          reportId: report._id,
          status: REPORT_STATUS.DISMISSED,
          actionTaken: suspensionLifted ? REPORT_ACTION_TAKEN.SUSPENSION_LIFTED : null,
          suspensionLifted,
          remainingPendingReports: otherPendingReports,
          campaign: {
            id: campaign._id,
            status: campaign.status,
            isSuspended: campaign.isSuspended,
          },
        };
      } else {
        throw new AppError('Invalid action', 'VALIDATION_ERROR');
      }
    });
  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  submitReport,
  confirmVisitorReport,
  suspendCampaignForReport,
   getReports,
  getReportStatistics,
  getReportById,
  reviewReport, // سيستعملها الاختبار، و reviewReport لاحقاً يحتاج منطقاً مشابهاً
};