// src/services/submission/submissionVerify.service.js
// نقطة التماس T1 بين المسارين. يستعملها: verify-link (أ)، و submit / updateLink / resubmit (ب).
//
// verifyPost({ creatorId, campaignId, platform, url, excludeSubmissionId?, skipLimitCheck? })
//   -> { campaign, application, parsed: { platform, canonicalUrl, externalId }, postMeta, evaluation }
//
// ترمي (أكواد العقد): APPLICATION_NOT_ACCEPTED, NOT_FOUND, CAMPAIGN_UNAVAILABLE, SUBMISSION_LIMIT_REACHED,
//   UNSUPPORTED_PLATFORM, PLATFORM_MISMATCH, INVALID_LINK, POST_NOT_PUBLIC, LINK_ALREADY_SUBMITTED
// ولا ترمي CONTENT_REQUIREMENTS_NOT_MET: ترجع evaluation.canSubmit ويقرر المستدعي
//   (verify-link يرد 200، و submit يرمي الخطأ).
//
// الخيارات:
//   excludeSubmissionId: يستثنى من فحص التكرار (تحديث رابط تسليم موجود لا يُعدّ تكراراً لنفسه)
//   skipLimitCheck:      يتجاوز حد التسليمات (تحديث الرابط لا يضيف تسليماً جديداً)
const Campaign = require('../../models/campaign');
const Submission = require('../../models/submission');
const { AppError } = require('../../utils/errors');
const { POST_FETCH_STATUS, buildSubmissionCode } = require('../../constants/submission.constants');
const {
  getAcceptedApplication,
  assertCampaignOpenForSubmissions,
  assertWithinSubmissionLimit,
} = require('../../utils/submission/submissionGuards.utils');
const { evaluateRequirements, isPlatformAllowed } = require('../../utils/submission/submissionRules.utils');
const { resolveAndParse } = require('../social/linkParser.service');
const { fetchPostMetadata } = require('../social/socialMetadata.service');

// الحقول التي يحتاجها الباقي من الحملة (لا نحمّل المواد والإحصاءات)
const CAMPAIGN_FIELDS = [
  'name',
  'advertiserId',
  'status',
  'isSuspended',
  'isArchived',
  'walletId',
  'remainingBudget',
  'pauseReason',
  'startDate',
  'endDate',
  'brief',
  'submissionRequirements',
  'halalDeclaration',
  'maxSubmissionsPerCreator',
].join(' ');

/** رابط مُسلَّم سابقاً: التفاصيل لصاحبه فقط، ولا نكشف تسليمات الآخرين */
const buildDuplicateError = (existing, creatorId) => {
  const isOwner = String(existing.creatorId) === String(creatorId);
  const details = isOwner
    ? {
        submissionId: existing._id,
        code: buildSubmissionCode(existing),
        campaignName: existing.campaignId && existing.campaignId.name ? existing.campaignId.name : null,
        submittedAt: existing.submittedAt || existing.createdAt || null,
        status: existing.status,
      }
    : null;

  return new AppError('This link has already been submitted', 'LINK_ALREADY_SUBMITTED', undefined, details);
};

const verifyPost = async ({
  creatorId,
  campaignId,
  platform,
  url,
  excludeSubmissionId = null,
  skipLimitCheck = false,
}) => {
  // 1) الصلاحية: مبدع مقبول، حملة مفتوحة، ضمن الحد
  const application = await getAcceptedApplication(creatorId, { campaignId });

  const campaign = await Campaign.findById(campaignId).select(CAMPAIGN_FIELDS).lean();
  if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');

  assertCampaignOpenForSubmissions(campaign);
  if (!skipLimitCheck) await assertWithinSubmissionLimit(creatorId, campaign);

  // 2) المنصة والرابط
  const requirements = campaign.submissionRequirements || {};
  if (!isPlatformAllowed(requirements, platform)) {
    throw new AppError(
      'This campaign does not accept this platform',
      'UNSUPPORTED_PLATFORM',
      undefined,
      { allowed: requirements.platforms }
    );
  }

  const parsed = await resolveAndParse(url, platform);

  // 3) بيانات المنشور (لا ترمي أبداً، تعيد fetchStatus)
  const postMeta = await fetchPostMetadata(parsed);

  if (postMeta.fetchStatus === POST_FETCH_STATUS.NOT_FOUND) {
    throw new AppError('Invalid link', 'INVALID_LINK', undefined, { httpStatus: 404 });
  }
  if (postMeta.fetchStatus === POST_FETCH_STATUS.PRIVATE) {
    throw new AppError('This post is not public', 'POST_NOT_PUBLIC');
  }

  // 4) التكرار (أي مبدع، أي حملة): الفهرس الفريد هو الحماية الحقيقية عند الإنشاء
  const duplicateFilter = { dedupKey: `${parsed.platform}:${parsed.externalId}`, linkLocked: true };
  if (excludeSubmissionId) duplicateFilter._id = { $ne: excludeSubmissionId };

  const existing = await Submission.findOne(duplicateFilter)
    .select('creatorId campaignId status submittedAt createdAt')
    .populate('campaignId', 'name')
    .lean();
  if (existing) throw buildDuplicateError(existing, creatorId);

  // 5) المتطلبات
  const evaluation = evaluateRequirements({ requirements, postMeta });

  return {
    campaign,
    application,
    parsed: {
      platform: parsed.platform,
      canonicalUrl: parsed.canonicalUrl,
      externalId: parsed.externalId,
    },
    postMeta,
    evaluation,
  };
};

module.exports = { verifyPost };