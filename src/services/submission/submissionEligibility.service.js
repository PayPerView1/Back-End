// src/services/submission/submissionEligibility.service.js
// GET /submissions/eligible-campaigns  (العقد §4.1)
const mongoose = require('mongoose');
const Application = require('../../models/application');
const Campaign = require('../../models/campaign');
const Submission = require('../../models/submission');
const { APPLICATION_STATUS } = require('../../constants/discovery.constants');
const { ELIGIBLE_TAB, LINK_HOLDING_STATUSES } = require('../../constants/submission.constants');
const { parsePagination, buildPageMeta } = require('../../utils/paginate.utils');
const { normalizeText } = require('../../utils/submission/hashtag.utils');
const { buildRequirementsView } = require('../../utils/submission/submissionRules.utils');
const {
  classifyEligibility,
  matchesTab,
  countTabs,
  buildCampaignCode,
} = require('../../utils/submission/submissionEligibility.utils');
const {
  getAcceptedApplication,
  isOpenForSubmissions,
  getSubmissionLimit,
  countActiveSubmissions,
} = require('../../utils/submission/submissionGuards.utils');
// سقف أمان: مبدع بأكثر من هذا العدد من الحملات المقبولة نادر جداً، وما زاد لا يُعرض.
const MAX_ACCEPTED_APPLICATIONS = 500;
const SEARCH_MAX_LENGTH = 100;

const CAMPAIGN_FIELDS = [
  'name',
  'coverImage',
  'advertiserId',
  'status',
  'pauseReason',
  'isSuspended',
  'isArchived',
  'walletId',
  'remainingBudget',
  'startDate',
  'endDate',
  'submissionRequirements',
  'maxSubmissionsPerCreator',
  'createdAt',
].join(' ');

/** عدد التسليمات الفعّالة للمبدع في كل حملة، باستعلام واحد (وليس استعلاماً لكل حملة) */
const countActiveByCampaign = async (creatorId, campaignIds) => {
  // ⚠️ aggregate لا يحوّل النصوص إلى ObjectId كما تفعل find (بدون هذا التحويل لا يطابق شيئاً فيظهر العدّ دائماً 0)
  const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

  const rows = await Submission.aggregate([
    {
      $match: {
        creatorId: toObjectId(creatorId),
        campaignId: { $in: campaignIds.map(toObjectId) },
        status: { $in: LINK_HOLDING_STATUSES },
      },
    },
    { $group: { _id: '$campaignId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

/** الجاهزة أولاً، ثم الأقرب انتهاءً (بلا تاريخ انتهاء في آخرها)، ثم الأحدث */
const compareItems = (a, b) => {
  if (a.cls.isReady !== b.cls.isReady) return a.cls.isReady ? -1 : 1;

  const ha = a.cls.hoursLeft;
  const hb = b.cls.hoursLeft;
  if (ha !== hb) {
    if (ha === null) return 1;
    if (hb === null) return -1;
    return ha - hb;
  }
  return new Date(b.campaign.createdAt) - new Date(a.campaign.createdAt);
};

const toCardDto = ({ campaign: c, cls }) => ({
  id: c._id,
  code: buildCampaignCode(c._id),
  name: c.name,
  coverImage: c.coverImage || null,
  brand: c.advertiserId
    ? {
        id: c.advertiserId._id,
        name: c.advertiserId.fullName,
        logo: c.advertiserId.profilePicture || null,
      }
    : null,
  isHalalVerified: true,
  requirements: buildRequirementsView(c),
  endDate: c.endDate || null,
  hoursLeft: cls.hoursLeft,
  availability: cls.availability,
  unavailableReason: cls.unavailableReason,
  badges: cls.badges,
  mySubmissions: { active: cls.active, limit: cls.limit },
});

/**
 * @param {ObjectId|string} creatorId
 * @param {{ tab?: string, search?: string, page?, perPage? }} query
 * @param {{ now?: Date }} [options]
 * @returns {Promise<{ data: Object[], meta: { counts }, pagination }>}
 *   counts تُحسب بعد البحث وقبل فلترة التبويب (فيبقى "الكل (n)" مساوياً لما يظهر في تبويب الكل)
 */
const getEligibleCampaigns = async (creatorId, query = {}, { now = new Date() } = {}) => {
  const { page, perPage, skip } = parsePagination(query, { defaultPerPage: 20, maxPerPage: 50 });
  const tab = Object.values(ELIGIBLE_TAB).includes(query.tab) ? query.tab : ELIGIBLE_TAB.ALL;
  const emptyResult = {
    data: [],
    meta: { counts: { all: 0, ready: 0, endingSoon: 0 } },
    pagination: buildPageMeta(0, page, perPage),
  };

  // 1) الطلبات المقبولة
  const applications = await Application.find({ creatorId, status: APPLICATION_STATUS.ACCEPTED })
    .select('campaignId')
    .limit(MAX_ACCEPTED_APPLICATIONS)
    .lean();
  if (applications.length === 0) return emptyResult;

  if (applications.length === MAX_ACCEPTED_APPLICATIONS) {
    console.warn(`[submissionEligibility] creator ${creatorId} reached the ${MAX_ACCEPTED_APPLICATIONS} accepted-applications cap`);
  }

  // 2) الحملات + المعلن + عدّ التسليمات الفعّالة (استعلامان متوازيان)
  // إزالة التكرار مع الحفاظ على نوع المعرّف الأصلي (ObjectId)
  const campaignIds = [...new Map(applications.map((a) => [String(a.campaignId), a.campaignId])).values()];
  const [campaigns, activeMap] = await Promise.all([
    Campaign.find({ _id: { $in: campaignIds } })
      .select(CAMPAIGN_FIELDS)
      .populate('advertiserId', 'fullName profilePicture')
      .lean(),
    countActiveByCampaign(creatorId, campaignIds),
  ]);

  // 3) التصنيف، واستبعاد ما لا يظهر أبداً
  let items = campaigns
    .map((campaign) => ({
      campaign,
      cls: classifyEligibility(campaign, { activeCount: activeMap.get(String(campaign._id)) || 0, now }),
    }))
    .filter((item) => item.cls.eligible);

  // 4) البحث (اسم الحملة أو المعلن) مع تجاهل التشكيل واختلاف الألف
  const needle = normalizeText(String(query.search || '').slice(0, SEARCH_MAX_LENGTH));
  if (needle) {
    items = items.filter(
      ({ campaign }) =>
        normalizeText(campaign.name).includes(needle) ||
        normalizeText(campaign.advertiserId && campaign.advertiserId.fullName).includes(needle)
    );
  }

  // 5) العدّادات قبل التبويب، ثم التبويب والترتيب والترقيم
  const counts = countTabs(items.map((item) => item.cls));
  const filtered = items.filter((item) => matchesTab(item.cls, tab)).sort(compareItems);

  return {
    data: filtered.slice(skip, skip + perPage).map(toCardDto),
    meta: { counts },
    pagination: buildPageMeta(filtered.length, page, perPage),
  };
};

const getSubmissionRequirements = async (creatorId, campaignId) => {
  // Verify accepted application
  const application = await getAcceptedApplication(creatorId, { campaignId });

  // Load campaign with required fields
  const campaign = await Campaign.findById(campaignId)
    .select([
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
    ])
    .populate('advertiserId', 'fullName profilePicture')
    .lean();

  if (!campaign) {
    throw new AppError('Campaign not found', 'NOT_FOUND');
  }

  // Check campaign availability
  const now = new Date();
  const isOpen = isOpenForSubmissions(campaign, now);
  const limit = getSubmissionLimit(campaign);
  const activeCount = await countActiveSubmissions(creatorId, campaign._id);

  let canSubmit = true;
  let cannotSubmitReason = null;

  if (!isOpen) {
    canSubmit = false;
    cannotSubmitReason = 'CAMPAIGN_UNAVAILABLE';
  } else if (activeCount >= limit) {
    canSubmit = false;
    cannotSubmitReason = 'SUBMISSION_LIMIT_REACHED';
  }

  return {
    campaignId: campaign._id,
    name: campaign.name,
    requirements: buildRequirementsView(campaign),
    brief: campaign.brief || null,
    endDate: campaign.endDate || null,
    mySubmissions: { active: activeCount, limit },
    canSubmit,
    cannotSubmitReason,
  };
};

module.exports = { getEligibleCampaigns, getSubmissionRequirements };