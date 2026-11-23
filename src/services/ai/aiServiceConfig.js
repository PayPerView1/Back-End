const DEFAULT_TIMEOUT_MS = 45000;
const MAX_TIMEOUT_MS = 120000;

const isEnabled = () => {
  const value = String(process.env.AI_SERVICE_ENABLED || '').trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(value);
};

const getBaseUrl = () => {
  const value = String(process.env.AI_SERVICE_BASE_URL || process.env.AI_SERVICE_URL || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    return value.replace(/\/+$/, '');
  } catch (_error) {
    return '';
  }
};

const getApiKey = () => String(process.env.AI_SERVICE_API_KEY || '').trim();

const getTimeoutMs = (fallbackMs = DEFAULT_TIMEOUT_MS, operationEnvKey = null) => {
  const configured = operationEnvKey && process.env[operationEnvKey]
    ? process.env[operationEnvKey]
    : process.env.AI_SERVICE_TIMEOUT_MS;
  const value = Number(configured);
  const candidate = Number.isFinite(value) && value > 0 ? value : fallbackMs;
  return Math.min(MAX_TIMEOUT_MS, Math.max(1000, Math.round(candidate)));
};

const isConfigured = () => isEnabled() && Boolean(getBaseUrl() && getApiKey());

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  getApiKey,
  getBaseUrl,
  getTimeoutMs,
  isConfigured,
  isEnabled,
};
