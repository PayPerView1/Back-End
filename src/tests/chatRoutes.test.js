require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const db = require('./helpers/db');
const f = require('./helpers/factories');

jest.mock('../services/ai/chatHistory.service', () => ({
  createThread: jest.fn(),
  listThreads: jest.fn(),
  getMessages: jest.fn(),
  sendMessage: jest.fn(),
  deleteThread: jest.fn(),
  submitFeedback: jest.fn(),
}));

const chatService = require('../services/ai/chatHistory.service');
const app = require('../app');
const API = '/api/v1/chat';
const id = () => new mongoose.Types.ObjectId().toString();

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});

test('chat proxy requires authentication', async () => {
  const response = await request(app).get(`${API}/threads`);
  expect(response.status).toBe(401);
});

test('validates message payload before calling the chat service', async () => {
  const brand = await f.createBrand();
  const response = await request(app)
    .post(`${API}/threads/${id()}/messages`)
    .set(f.authHeader(brand))
    .send({ content: '   ' });

  expect(response.status).toBe(400);
  expect(chatService.sendMessage).not.toHaveBeenCalled();
});

test('stores message feedback through the authenticated thread route', async () => {
  const brand = await f.createBrand();
  const threadId = id();
  const messageId = id();
  chatService.submitFeedback.mockResolvedValue({
    messageId,
    feedback: { rating: 'HELPFUL', comment: '', submittedAt: new Date() },
  });

  const response = await request(app)
    .patch(`${API}/threads/${threadId}/messages/${messageId}/feedback`)
    .set(f.authHeader(brand))
    .send({ rating: 'HELPFUL' });

  expect(response.status).toBe(200);
  expect(chatService.submitFeedback).toHaveBeenCalledWith(
    threadId,
    messageId,
    expect.anything(),
    { rating: 'HELPFUL', comment: '' }
  );
});

test('rejects malformed thread ids before database access', async () => {
  const brand = await f.createBrand();
  const response = await request(app)
    .get(`${API}/threads/not-an-object-id/messages`)
    .set(f.authHeader(brand));

  expect(response.status).toBe(400);
  expect(chatService.getMessages).not.toHaveBeenCalled();
});
