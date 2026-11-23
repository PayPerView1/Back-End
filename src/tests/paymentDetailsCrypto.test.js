const { encryptDetails, decryptDetails } = require('../services/wallet/paymentDetailsCrypto.service');

afterEach(() => {
  delete process.env.PAYMENT_DETAILS_ENCRYPTION_KEY;
  delete process.env.PAYMENT_DETAILS_ENCRYPTION_KEYS;
  delete process.env.PAYMENT_DETAILS_ACTIVE_KEY_VERSION;
  delete process.env.PAYMENT_DETAILS_FINGERPRINT_KEY;
});

test('encrypts payout details and keeps decrypt access explicit', () => {
  process.env.PAYMENT_DETAILS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
  const details = { accountName: 'Creator', accountIdentifier: 'creator@example.test' };

  const encrypted = encryptDetails(details);

  expect(encrypted.ciphertext).not.toContain(details.accountIdentifier);
  expect(decryptDetails(encrypted)).toEqual(details);
});

test('decrypts records with retained key versions after the active key rotates', () => {
  const oldKey = Buffer.alloc(32, 4).toString('base64');
  const newKey = Buffer.alloc(32, 8).toString('base64');
  process.env.PAYMENT_DETAILS_ENCRYPTION_KEYS = JSON.stringify({ v1: oldKey, v2: newKey });
  process.env.PAYMENT_DETAILS_ACTIVE_KEY_VERSION = 'v1';
  const encrypted = encryptDetails({ accountName: 'A', accountIdentifier: 'account-1234' });

  process.env.PAYMENT_DETAILS_ACTIVE_KEY_VERSION = 'v2';
  expect(decryptDetails(encrypted)).toEqual({ accountName: 'A', accountIdentifier: 'account-1234' });
  expect(encryptDetails({ accountName: 'B', accountIdentifier: 'account-5678' }).keyVersion).toBe('v2');
});

test('payment fingerprints remain stable when the active encryption key rotates', () => {
  const oldKey = Buffer.alloc(32, 4).toString('base64');
  const newKey = Buffer.alloc(32, 8).toString('base64');
  process.env.PAYMENT_DETAILS_ENCRYPTION_KEYS = JSON.stringify({ v1: oldKey, v2: newKey });
  process.env.PAYMENT_DETAILS_ACTIVE_KEY_VERSION = 'v1';
  const { fingerprint } = require('../services/wallet/paymentDetailsCrypto.service');
  const before = fingerprint('PAYPAL', 'Creator@Example.test');

  process.env.PAYMENT_DETAILS_ACTIVE_KEY_VERSION = 'v2';
  expect(fingerprint('PAYPAL', 'creator@example.test')).toBe(before);
});

test('refuses to store payout details without a valid 256-bit encryption key', () => {
  expect(() => encryptDetails({ accountIdentifier: 'account' }))
    .toThrow(expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }));
});
