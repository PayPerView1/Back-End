const mongoose = require('mongoose');
const Application = require('../../models/application');
const Campaign = require('../../models/campaign');
const { AppError } = require('../../utils/errors');
const { CAMPAIGN_ACTION } = require('../../constants/campaign.constants');
const { APPLICATION_STATUS, NOTIFICATION_TYPE } = require('../../constants/discovery.constants');
const { isCampaignSuspended } = require('../../utils/campaign/campaignStatus.utils');
const { notifyUser } = require('../notification/notification.service');
const { buildNotification } = require('../notification/notification.templates');
const notificationEmails = require('../notification/notificationEmails');
const {
  isOpenForApplications,
  isPubliclyVisible,
  getAvailability,
} = require('../../utils/campaign/campaignVisibility.utils');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');

// ============================================
// 1. Apply to a Campaign
// ============================================
/**
 * @param {Object} creator — { _id, ... }
 * @param {string} campaignId
 * @param {{ message?: string }} body
 */
const applyToCampaign = async (creator, campaignId, { message = '' } = {}) => {
  // 1. جلب الحملة
  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // 2. فحص ظهور + إمكانية التقديم
  if (!isPubliclyVisible(campaign) || !isOpenForApplications(campaign)) {
    // رسالة موحّدة بدون كشف السبب
    throw new AppError('This campaign is currently unavailable.', 'CAMPAIGN_UNAVAILABLE');
  }

  // 3. فحص التقديم الموجود
  const existing = await Application.findOne({
    campaignId: campaign._id,
    creatorId: creator._id,
  });

  let application;

  if (existing) {
    if (existing.status === APPLICATION_STATUS.WITHDRAWN) {
      // إعادة استخدام نفس المستند
      existing.status = APPLICATION_STATUS.PENDING;
      existing.message = message || existing.message;
      existing.appliedAt = new Date();
      existing.withdrawnAt = null;
      existing.reviewedAt = null;
      existing.reviewedBy = null;

      // ⚠️ نزيد applicantsCount ذرّياً مع شرط الحد
      const updated = await Campaign.findOneAndUpdate(
        {
          _id: campaign._id,
          $or: [
            { maxApplicants: null },
            { $expr: { $lt: ['$applicantsCount', '$maxApplicants'] } },
          ],
        },
        { $inc: { applicantsCount: 1 } },
        { new: true }
      );

      if (!updated) {
        throw new AppError('Maximum number of applicants reached.', 'APPLICANT_LIMIT_REACHED');
      }

      application = await existing.save();
    } else {
      // PENDING / ACCEPTED / REJECTED → ممنوع إعادة التقديم
      throw new AppError('You have already applied for this campaign.', 'ALREADY_APPLIED');
    }
  } else {
    // 4. تقديم جديد — transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 4a. زيادة applicantsCount ذرّياً مع فحص الحد
      const updatedCampaign = await Campaign.findOneAndUpdate(
        {
          _id: campaign._id,
          $or: [
            { maxApplicants: null },
            { $expr: { $lt: ['$applicantsCount', '$maxApplicants'] } },
          ],
        },
        { $inc: { applicantsCount: 1 } },
        { new: true, session }
      );

      if (!updatedCampaign) {
        throw new AppError('Maximum number of applicants reached.', 'APPLICANT_LIMIT_REACHED');
      }

      // 4b. إنشاء الـ Application
      const created = await Application.create(
        [
          {
            campaignId: campaign._id,
            creatorId: creator._id,
            message: message || '',
            status: APPLICATION_STATUS.PENDING,
            appliedAt: new Date(),
          },
        ],
        { session }
      );

      application = created[0];

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // 5. إشعار المعلن (بعد الـ commit)
  try {
    const notification = buildNotification(
  NOTIFICATION_TYPE.NEW_APPLICANT,
  { campaignName: campaign.name, creatorName: creator.fullName },
  { campaignId: campaign._id.toString(), applicationId: application._id.toString() }
);

    await notifyUser(campaign.advertiserId, notification);
  } catch (err) {
    console.error('[application.service] notify advertiser failed:', err.message);
  }

  return {
    id: application._id,
    campaignId: application.campaignId,
    status: application.status,
    message: application.message,
    appliedAt: application.appliedAt,
  };
};

// ============================================
// 2. Withdraw Application
// ============================================
const withdrawApplication = async (applicationId, creatorId) => {
  const application = await Application.findOne({
    _id: applicationId,
    creatorId,
  });

  if (!application) {
    throw new AppError('Application not found', 'NOT_FOUND');
  }

  if (application.status !== APPLICATION_STATUS.PENDING) {
    throw new AppError(
      'This application can no longer be withdrawn.',
      'APPLICATION_NOT_WITHDRAWABLE'
    );
  }

  application.status = APPLICATION_STATUS.WITHDRAWN;
  application.withdrawnAt = new Date();
  await application.save();

  // إنقاص applicantsCount بشرط > 0
  await Campaign.updateOne(
    {
      _id: application.campaignId,
      applicantsCount: { $gt: 0 },
    },
    { $inc: { applicantsCount: -1 } }
  );

  return {
    id: application._id,
    status: application.status,
  };
};

// ============================================
// 3. My Applications
// ============================================
const getMyApplications = async (creatorId, filters = {}) => {
  const { page, perPage, skip } = parsePagination(filters, {
    defaultPerPage: 20,
    maxPerPage: 50,
  });

  const query = { creatorId };

  if (filters.status) {
    query.status = filters.status;
  } else {
    // الافتراضي: استثناء WITHDRAWN
    query.status = { $ne: APPLICATION_STATUS.WITHDRAWN };
  }

  const [applications, total] = await Promise.all([
    Application.find(query)
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: 'campaignId',
        select: 'name advertiserId contentType cpm remainingBudget status isSuspended isArchived endDate startDate',
        populate: {
          path: 'advertiserId',
          select: 'fullName profilePicture',
        },
      })
      .lean(),
    Application.countDocuments(query),
  ]);

  const data = applications.map((a) => {
    const campaign = a.campaignId || {};

    // availability بناءً على الحملة
    let availability = 'UNAVAILABLE';
    if (campaign._id && isPubliclyVisible(campaign)) {
      availability = getAvailability(campaign);
    }

    return {
      id: a._id,
      status: a.status,
      message: a.message,
      appliedAt: a.appliedAt,
      reviewedAt: a.reviewedAt,
      campaign: campaign._id
        ? {
            id: campaign._id,
            name: campaign.name,
            brand: campaign.advertiserId
              ? {
                  id: campaign.advertiserId._id,
                  name: campaign.advertiserId.fullName,
                  logo: campaign.advertiserId.profilePicture || null,
                }
              : null,
            contentType: campaign.contentType,
            cpm: campaign.cpm,
            availability,
          }
        : null,
    };
  });

  return {
    data,
    pagination: buildPageMeta(total, page, perPage),
  };
};

// ============================================
// 4. Accepted Materials (Download)
// ============================================
const getAcceptedMaterials = async (applicationId, creatorId) => {
  const application = await Application.findOne({
    _id: applicationId,
    creatorId,
  })
    .populate('campaignId')
    .lean();

  if (!application) {
    throw new AppError('Application not found', 'NOT_FOUND');
  }

  if (application.status !== APPLICATION_STATUS.ACCEPTED) {
    throw new AppError('You do not have access to these materials.', 'FORBIDDEN');
  }

  const campaign = application.campaignId;
  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // منع التنزيل إذا الحملة ملغاة أو موقوفة
  if (campaign.isSuspended === true) {
    throw new AppError('This campaign is currently unavailable.', 'CAMPAIGN_UNAVAILABLE');
  }

  const materials = (campaign.materials || []).map((m) => ({
    id: m._id,
    fileName: m.fileName,
    fileType: m.fileType,
    mimeType: m.mimeType,
    fileSizeKb: m.fileSizeKb,
    downloadUrl: m.fileUrl,
  }));

  return materials;
};

/**
 * Get all applications for a campaign (advertiser side)
 */
const getCampaignApplications = async (campaignId, filters = {}) => {
  const { status = 'PENDING', page = 1, perPage = 20 } = filters;

  const filter = { campaignId };
  if (status !== 'ALL') {
    filter.status = status;
  }

  const skip = (page - 1) * perPage;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate('creatorId', 'fullName profilePicture country city bio')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Application.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page: parseInt(page),
      perPage: parseInt(perPage),
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

/**
 * Update application status (accept/reject)
 */
const updateApplicationStatus = async (applicationId, advertiserId, status) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const application = await Application.findById(applicationId)
        .populate('campaignId', 'name advertiserId status isSuspended')
        .session(session);

      if (!application) {
        throw new AppError('Application not found', 'NOT_FOUND');
      }

      // Verify ownership
      if (String(application.campaignId.advertiserId) !== String(advertiserId)) {
        throw new AppError('You are not authorized to review this application', 'FORBIDDEN');
      }

      // Check if already reviewed
      if (application.status !== APPLICATION_STATUS.PENDING) {
        throw new AppError('This application has already been reviewed', 'APPLICATION_ALREADY_REVIEWED');
      }

      // Check campaign status
      if (application.campaignId.status === 'CANCELLED') {
        throw new AppError('This campaign is no longer available', 'CAMPAIGN_UNAVAILABLE');
      }

      if (isCampaignSuspended(application.campaignId)) {
        throw new AppError('This campaign is under review after a report', 'CAMPAIGN_SUSPENDED');
      }

      // Update application
      application.status = status;
      application.reviewedAt = new Date();
      application.reviewedBy = advertiserId;
      await application.save({ session });

      // Update campaign stats
      if (status === APPLICATION_STATUS.ACCEPTED) {
        await Campaign.findByIdAndUpdate(
          application.campaignId._id,
          { $inc: { 'stats.totalCreators': 1 } },
          { session }
        );
      } else if (status === APPLICATION_STATUS.REJECTED) {
        await Campaign.findByIdAndUpdate(
          application.campaignId._id,
          { $inc: { applicantsCount: -1 } },
          {
            session,
            // Prevent negative count
            runValidators: false
          }
        );
      }
    });

    // Fetch updated application for response
    const updatedApplication = await Application.findById(applicationId)
      .populate('creatorId', 'fullName email')
      .lean();

    // Send notification to creator
    const creator = updatedApplication.creatorId;
    if (creator) {
      const notificationType = status === APPLICATION_STATUS.ACCEPTED
        ? 'APPLICATION_ACCEPTED'
        : 'APPLICATION_REJECTED';

      await notifyUser(
        creator._id,
        buildNotification(
          notificationType,
          { campaignName: updatedApplication.campaignId.name },
          {
            campaignId: updatedApplication.campaignId._id,
            applicationId: updatedApplication._id
          }
        ),
        () => {
          if (status === APPLICATION_STATUS.ACCEPTED) {
            return notificationEmails.sendApplicationAcceptedEmail(creator, {
              campaignName: updatedApplication.campaignId.name
            });
          } else {
            return notificationEmails.sendApplicationRejectedEmail(creator, {
              campaignName: updatedApplication.campaignId.name
            });
          }
        }
      );
    }

    return {
      applicationId: updatedApplication._id,
      status: updatedApplication.status,
      reviewedAt: updatedApplication.reviewedAt,
    };
  } catch (error) {
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  applyToCampaign,
  withdrawApplication,
  getMyApplications,
  getAcceptedMaterials,
  getCampaignApplications,
  updateApplicationStatus,
};