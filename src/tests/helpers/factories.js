// tests/helpers/factories.js
// مصانع بيانات للاختبارات. افترضت أن التوكن يُوقَّع بـ { id } كما يقرأه authMiddleware.protect
// (إن كان generateTokens يضيف حقولاً أخرى عدّل authToken هنا فقط).
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../../models/user');
const Campaign = require('../../models/campaign');
const Application = require('../../models/application');
const Submission = require('../../models/submission');
const { CAMPAIGN_STATUS } = require('../../constants/campaign.constants');
const { APPLICATION_STATUS } = require('../../constants/discovery.constants');
const { SUBMISSION_STATUS } = require('../../constants/submission.constants');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

const createUser = async (overrides = {}) => {
  const n = next();
  return User.create({
    fullName: `User ${n}`,
    email: `user${n}@test.com`,
    password: 'password123',
    role: 'CLIPPER',
    isVerified: true,
    ...overrides,
  });
};

const createBrand = (overrides = {}) => createUser({ role: 'BRAND', ...overrides });
const createAdmin = (overrides = {}) => createUser({ role: 'ADMIN', ...overrides });

/** حملة نشطة ومموّلة وظاهرة للمبدعين (walletId مطلوب لظهورها) */
const createCampaign = async (advertiser, overrides = {}) => {
  const n = next();
  return Campaign.create({
    advertiserId: advertiser._id,
    name: `Campaign ${n}`,
    contentType: 'CLIPPING',
    category: 'CLIPPING',
    totalBudget: 1000,
    remainingBudget: 1000,
    cpm: 5,
    brief: { mainIdea: 'Test brief' },
    targetCountries: ['SAU'],
    status: CAMPAIGN_STATUS.ACTIVE,
    walletId: new mongoose.Types.ObjectId(),
    ...overrides,
  });
};

const createAcceptedApplication = (creator, campaign, overrides = {}) =>
  Application.create({
    campaignId: campaign._id,
    creatorId: creator._id,
    status: APPLICATION_STATUS.ACCEPTED,
    reviewedAt: new Date(),
    ...overrides,
  });

/** تسليم جاهز (يجتاز pre-validate: dedupKey و linkLocked يُحسبان تلقائياً) */
const createSubmission = async ({ creator, campaign, application }, overrides = {}) => {
  const n = next();
  return Submission.create({
    campaignId: campaign._id,
    creatorId: creator._id,
    applicationId: application._id,
    platform: 'TIKTOK',
    postUrl: `https://www.tiktok.com/@user/video/${7000000000000000000 + n}`,
    canonicalUrl: `https://www.tiktok.com/@user/video/${7000000000000000000 + n}`,
    externalId: String(7000000000000000000 + n),
    halalPledge: { accepted: true },
    status: SUBMISSION_STATUS.SUBMITTED,
    ...overrides,
  });
};

const authToken = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const authHeader = (user) => ({ Authorization: `Bearer ${authToken(user)}` });

module.exports = {
  createUser,
  createBrand,
  createAdmin,
  createCampaign,
  createAcceptedApplication,
  createSubmission,
  authToken,
  authHeader,
};