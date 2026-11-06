// src/tests/submissionDraft.test.js
require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/user');
const Campaign = require('../models/campaign');
const Application = require('../models/application');
const SubmissionDraft = require('../models/submissionDraft');
const generateToken = require('../utils/generateTokens');
const { CAMPAIGN_STATUS } = require('../constants/campaign.constants');
const { APPLICATION_STATUS } = require('../constants/discovery.constants');

jest.setTimeout(40000);

let creatorUser;
let creatorToken;
let brandUser;
let brandToken;
let campaign;
let application;

beforeAll(async () => {
  if (!process.env.MONGO_URI_TEST) {
    throw new Error('MONGO_URI_TEST is not defined in .env file');
  }
  await mongoose.connect(process.env.MONGO_URI_TEST);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Campaign.deleteMany({});
  await Application.deleteMany({});
  await SubmissionDraft.deleteMany({});

  brandUser = await User.create({
    fullName: 'Brand Owner',
    email: 'brand@example.com',
    password: 'hashedPassword123',
    role: 'BRAND',
  });
  brandToken = generateToken(brandUser._id, brandUser.role);

  creatorUser = await User.create({
    fullName: 'Content Creator',
    email: 'creator@example.com',
    password: 'hashedPassword123',
    role: 'CLIPPER',
  });
  creatorToken = generateToken(creatorUser._id, creatorUser.role);

  campaign = await Campaign.create({
    advertiserId: brandUser._id,
    name: 'Test Campaign',
    contentType: 'CLIPPING',
    category: 'CLIPPING',
    totalBudget: 5000,
    remainingBudget: 5000,
    cpm: 10,
    brief: { mainIdea: 'Test brief' },
    targetCountries: ['SAU'],
    status: CAMPAIGN_STATUS.ACTIVE,
    walletId: new mongoose.Types.ObjectId(),
  });

  application = await Application.create({
    campaignId: campaign._id,
    creatorId: creatorUser._id,
    status: APPLICATION_STATUS.ACCEPTED,
    reviewedAt: new Date(),
  });
});

describe('Submission Draft Endpoints', () => {
  describe('GET /api/v1/campaigns/:campaignId/submission-draft', () => {
    it('should return 403 if creator is not accepted into campaign', async () => {
      // Create a new user without an accepted application
      const otherCreator = await User.create({
        fullName: 'Other Creator',
        email: 'other@example.com',
        password: 'hashedPassword123',
        role: 'CLIPPER',
      });
      const otherToken = generateToken(otherCreator._id, otherCreator.role);

      const res = await request(app)
        .get(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('APPLICATION_NOT_ACCEPTED');
    });

    it('should return null data when no draft exists', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('should return draft when it exists', async () => {
      await SubmissionDraft.create({
        creatorId: creatorUser._id,
        campaignId: campaign._id,
        platform: 'TIKTOK',
        postUrl: 'https://www.tiktok.com/@user/video/123',
        notes: 'Test notes',
        halalPledge: true,
      });

      const res = await request(app)
        .get(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.platform).toBe('TIKTOK');
    });
  });

  describe('PUT /api/v1/campaigns/:campaignId/submission-draft', () => {
    it('should create a new draft', async () => {
      const res = await request(app)
        .put(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          platform: 'TIKTOK',
          url: 'https://www.tiktok.com/@user/video/123',
          notes: 'Test notes',
          halalPledge: true,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platform).toBe('TIKTOK');
      expect(res.body.data.postUrl).toBe('https://www.tiktok.com/@user/video/123');
    });

    it('should update an existing draft', async () => {
      await SubmissionDraft.create({
        creatorId: creatorUser._id,
        campaignId: campaign._id,
        platform: 'TIKTOK',
        postUrl: 'https://www.tiktok.com/@user/video/123',
        notes: 'Old notes',
        halalPledge: false,
      });

      const res = await request(app)
        .put(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          platform: 'YOUTUBE',
          url: 'https://youtube.com/shorts/abc123',
          notes: 'Updated notes',
          halalPledge: true,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platform).toBe('YOUTUBE');
      expect(res.body.data.notes).toBe('Updated notes');
    });

    it('should return 403 if creator is not accepted', async () => {
      // Create a new user without an accepted application
      const otherCreator = await User.create({
        fullName: 'Other Creator',
        email: 'other@example.com',
        password: 'hashedPassword123',
        role: 'CLIPPER',
      });
      const otherToken = generateToken(otherCreator._id, otherCreator.role);

      const res = await request(app)
        .put(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          platform: 'TIKTOK',
          url: 'https://www.tiktok.com/@user/video/123',
          halalPledge: true,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('APPLICATION_NOT_ACCEPTED');
    });
  });

  describe('DELETE /api/v1/campaigns/:campaignId/submission-draft', () => {
    it('should delete an existing draft', async () => {
      await SubmissionDraft.create({
        creatorId: creatorUser._id,
        campaignId: campaign._id,
        platform: 'TIKTOK',
        postUrl: 'https://www.tiktok.com/@user/video/123',
        notes: 'Test notes',
        halalPledge: true,
      });

      const res = await request(app)
        .delete(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      const draft = await SubmissionDraft.findOne({ creatorId: creatorUser._id, campaignId: campaign._id });
      expect(draft).toBeNull();
    });

    it('should return 403 if creator is not accepted', async () => {
      // Create a new user without an accepted application
      const otherCreator = await User.create({
        fullName: 'Other Creator',
        email: 'other@example.com',
        password: 'hashedPassword123',
        role: 'CLIPPER',
      });
      const otherToken = generateToken(otherCreator._id, otherCreator.role);

      const res = await request(app)
        .delete(`/api/v1/campaigns/${campaign._id}/submission-draft`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('APPLICATION_NOT_ACCEPTED');
    });
  });
});
