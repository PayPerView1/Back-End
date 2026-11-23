jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));

const axios = require('axios');
const client = require('../services/ai/aiChatbotClient.service');

const environmentKeys = ['AI_SERVICE_BASE_URL', 'AI_SERVICE_URL', 'AI_SERVICE_API_KEY', 'AI_SERVICE_ENABLED'];
const originalEnv = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AI_SERVICE_BASE_URL = 'http://ai.local';
  process.env.AI_SERVICE_API_KEY = 'service-key';
  delete process.env.AI_SERVICE_URL;
  delete process.env.AI_SERVICE_ENABLED;
});

afterAll(() => {
  for (const key of environmentKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('does not retry thread creation after an ambiguous upstream failure', async () => {
  axios.post.mockRejectedValueOnce(Object.assign(new Error('upstream error'), {
    response: { status: 503 },
  }));

  await expect(client.createAiThread('Bearer token', 'title')).rejects.toThrow('AI service request failed');
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith('http://ai.local/api/v1/ai/threads', { title: 'title' }, expect.objectContaining({
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
  }));
});

test('does not retry message creation after an ambiguous upstream failure', async () => {
  axios.post.mockRejectedValueOnce(Object.assign(new Error('upstream error'), {
    response: { status: 503 },
  }));

  await expect(client.sendAiMessage('Bearer token', 'ai-thread', 'hello')).rejects.toThrow('AI service request failed');
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('does not select a hardcoded remote AI Service when its base URL is missing', async () => {
  delete process.env.AI_SERVICE_BASE_URL;
  delete process.env.AI_SERVICE_URL;

  await expect(client.createAiThread('Bearer token', 'title')).rejects.toMatchObject({ code: 'AI_SERVICE_UNAVAILABLE' });
  expect(axios.post).not.toHaveBeenCalled();
});
