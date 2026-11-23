require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const db = require('./helpers/db');
const f = require('./helpers/factories');

jest.mock('../services/submission/submissionViews.service', () => ({
  getSubmissionViews: jest.fn(),
  getCampaignAnalytics: jest.fn(),
  listReviewQueue: jest.fn(),
  reviewSnapshot: jest.fn(),
  runViewTracking: jest.fn(),
  sampleSubmission: jest.fn(),
}));

const views = require('../services/submission/submissionViews.service');
const app = require('../app');
const API = '/api/v1';
const id = () => new mongoose.Types.ObjectId().toString();

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});

test('campaign analytics is restricted to a brand and passes the JWT owner id', async () => {
  const creator = await f.createUser();
  const forbidden = await request(app)
    .get(`${API}/campaigns/${id()}/analytics`)
    .set(f.authHeader(creator));
  expect(forbidden.status).toBe(403);
  expect(views.getCampaignAnalytics).not.toHaveBeenCalled();

  const brand = await f.createBrand();
  views.getCampaignAnalytics.mockResolvedValue({ totalViews: 0, viewsAvailable: false });
  const accepted = await request(app)
    .get(`${API}/campaigns/${id()}/analytics`)
    .set(f.authHeader(brand));
  expect(accepted.status).toBe(200);
  expect(views.getCampaignAnalytics).toHaveBeenCalledWith(expect.any(String), brand._id);
});

test('fraud review queue is restricted to ADMIN', async () => {
  const brand = await f.createBrand();
  const response = await request(app)
    .get(`${API}/admin/view-snapshots/review`)
    .set(f.authHeader(brand));
  expect(response.status).toBe(403);
  expect(views.listReviewQueue).not.toHaveBeenCalled();
});

test('submission view route validates the identifier before service access', async () => {
  const creator = await f.createUser();
  const response = await request(app)
    .get(`${API}/submissions/not-an-id/views`)
    .set(f.authHeader(creator));
  expect(response.status).toBe(400);
  expect(views.getSubmissionViews).not.toHaveBeenCalled();
});
