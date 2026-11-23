const crypto = require('crypto');
const { AppError } = require('../../utils/errors');

const getKeyRing = () => {
  try {
    if (process.env.PAYMENT_DETAILS_ENCRYPTION_KEYS) {
      const configured = JSON.parse(process.env.PAYMENT_DETAILS_ENCRYPTION_KEYS);
      const keys = Object.fromEntries(Object.entries(configured).map(([version, encoded]) => [
        version,
        Buffer.from(encoded, 'base64'),
      ]));
      const activeVersion = process.env.PAYMENT_DETAILS_ACTIVE_KEY_VERSION;
      if (!activeVersion || !keys[activeVersion] || Object.values(keys).some((key) => key.length !== 32)) {
        throw new Error('Invalid payment encryption key ring');
      }
      return { keys, activeVersion };
    }

    const encoded = process.env.PAYMENT_DETAILS_ENCRYPTION_KEY;
    const key = encoded ? Buffer.from(encoded, 'base64') : null;
    if (!key || key.length !== 32) throw new Error('Missing payment encryption key');
    return { keys: { v1: key }, activeVersion: 'v1' };
  } catch {
    throw new AppError('Secure payment method storage is not configured', 'SERVICE_UNAVAILABLE');
  }
};

const getKey = (version) => {
  const ring = getKeyRing();
  const key = ring.keys[version || ring.activeVersion];
  if (!key) throw new AppError('Payment method key version is unavailable', 'SERVICE_UNAVAILABLE');
  return { key, keyVersion: version || ring.activeVersion };
};

const encryptDetails = (details) => {
  const { key, keyVersion } = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(details), 'utf8'),
    cipher.final(),
  ]);
  return {
    keyVersion,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

const decryptDetails = ({ keyVersion = 'v1', iv, tag, ciphertext }) => {
  const { key } = getKey(keyVersion);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
};

const getFingerprintKey = () => {
  const configured = process.env.PAYMENT_DETAILS_FINGERPRINT_KEY;
  if (configured) {
    const key = Buffer.from(configured, 'base64');
    if (key.length !== 32) {
      throw new AppError('Payment method fingerprint key is not configured correctly', 'SERVICE_UNAVAILABLE');
    }
    return key;
  }

  // يجب إبقاء المفتاح v1 متاحاً أثناء استخدام هذا البديل؛ يُفضَّل مفتاح بصمة منفصل للإنتاج.
  const ring = getKeyRing();
  const stableVersion = ring.keys.v1 ? 'v1' : Object.keys(ring.keys).sort()[0];
  return ring.keys[stableVersion];
};

const fingerprint = (type, accountIdentifier) =>
  crypto.createHmac('sha256', getFingerprintKey())
    .update(`${type}:${String(accountIdentifier).trim().toLowerCase()}`)
    .digest('hex');

module.exports = { encryptDetails, decryptDetails, fingerprint };
