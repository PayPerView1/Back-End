require('dotenv').config();

const request = require('supertest');
const app = require('../app');

test('throttles repeated login attempts from one IP', async () => {
  const responses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    responses.push(
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email', password: 'x' })
    );
  }

  expect(responses.slice(0, 10).every((response) => response.status === 400)).toBe(true);
  expect(responses[10].status).toBe(429);
  expect(responses[10].body.code).toBe('RATE_LIMIT_EXCEEDED');
});

test('rejects malformed reset tokens before reflecting them into the reset page', async () => {
  const response = await request(app).get('/api/v1/auth/reset-password/not-a-token');

  expect(response.status).toBe(400);
  expect(response.text).not.toContain('<script>');
  expect(response.text).not.toContain('not-a-token');
});
