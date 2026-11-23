jest.mock('../models/user', () => ({ findById: jest.fn() }));

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { protect } = require('../middlewares/authMiddleware');

const secret = 'unit-test-jwt-secret';

const requestFor = (payload) => ({
  headers: {
    authorization: `Bearer ${jwt.sign(payload, secret, { expiresIn: '1h' })}`,
  },
});

const responseMock = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  User.findById.mockReset();
});

test('accepts a current token version and attaches the database user', async () => {
  const user = { _id: 'user-1', tokenVersion: 3, role: 'CLIPPER' };
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  const req = requestFor({ id: 'user-1', ver: 3 });
  const res = responseMock();
  const next = jest.fn();

  await protect(req, res, next);

  expect(User.findById).toHaveBeenCalledWith('user-1');
  expect(req.user).toBe(user);
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
});

test('rejects a token revoked by logout or a password change', async () => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ _id: 'user-1', tokenVersion: 4 }),
  });
  const req = requestFor({ id: 'user-1', ver: 3 });
  const res = responseMock();
  const next = jest.fn();

  await protect(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('accepts legacy tokens for users whose token version is still zero', async () => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ _id: 'user-1', tokenVersion: 0 }),
  });
  const req = requestFor({ id: 'user-1' });
  const res = responseMock();
  const next = jest.fn();

  await protect(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
});
