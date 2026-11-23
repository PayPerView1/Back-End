require('dotenv').config();

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createUser } = require('./helpers/factories');
const { sendEmail } = require('../services/emailService');
const generateToken = require('../utils/generateTokens');

jest.setTimeout(120000);

beforeAll(db.connect);
afterAll(db.disconnect);
afterEach(async () => {
  await db.clearDatabase();
  jest.clearAllMocks();
});

describe('authentication security', () => {
  test('logout revokes existing JWTs and a new login receives the current version', async () => {
    const user = await createUser({ isVerified: true, password: 'Password123!' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Password123!' });

    expect(login.status).toBe(200);
    expect(jwt.verify(login.body.token, process.env.JWT_SECRET).ver).toBe(0);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(logout.status).toBe(200);

    const staleTokenResponse = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(staleTokenResponse.status).toBe(401);

    const nextLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Password123!' });
    expect(nextLogin.status).toBe(200);
    expect(jwt.verify(nextLogin.body.token, process.env.JWT_SECRET).ver).toBe(1);

    const changePassword = await request(app)
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${nextLogin.body.token}`)
      .send({
        currentPassword: 'Password123!',
        newPassword: 'NextPassword123!',
        confirmPassword: 'NextPassword123!',
      });
    expect(changePassword.status).toBe(200);

    const changedTokenResponse = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${nextLogin.body.token}`);
    expect(changedTokenResponse.status).toBe(401);
  });

  test('password reset revokes previously issued JWTs', async () => {
    const user = await createUser({ isVerified: true, password: 'Password123!' });
    const oldToken = generateToken(user._id, user.role, user.tokenVersion || 0);

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.success).toBe(true);

    const emailPayload = sendEmail.mock.calls[0][0];
    const resetToken = emailPayload.message.match(/reset-password\/([a-f\d]{64})/i)?.[1];
    expect(resetToken).toBeTruthy();

    const reset = await request(app)
      .post(`/api/v1/auth/reset-password/${resetToken}`)
      .send({ password: 'NewPassword123!', confirmPassword: 'NewPassword123!' });
    expect(reset.status).toBe(200);

    const staleTokenResponse = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(staleTokenResponse.status).toBe(401);
  });

  test('forgot and resend responses do not reveal whether an email is registered', async () => {
    const unverified = await createUser({ isVerified: false });

    const unknownReset = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'missing@example.com' });
    const knownReset = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: unverified.email });

    expect(unknownReset.status).toBe(200);
    expect(knownReset.status).toBe(200);
    expect(unknownReset.body).toEqual(knownReset.body);

    const unknownResend = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'missing@example.com' });
    const knownResend = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: unverified.email });

    expect(unknownResend.status).toBe(200);
    expect(knownResend.status).toBe(200);
    expect(unknownResend.body).toEqual(knownResend.body);
  });

  test('validates login and recovery request bodies', async () => {
    const invalidLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });
    const invalidRecovery = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', '192.168.1.99')
      .send({ email: 'not-an-email' });

    expect(invalidLogin.status).toBe(400);
    expect(invalidLogin.body.code).toBe('VALIDATION_ERROR');
    expect(invalidRecovery.status).toBe(400);
    expect(invalidRecovery.body.code).toBe('VALIDATION_ERROR');
  });
});
