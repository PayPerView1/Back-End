const axios = require('axios');
const config = require('./aiServiceConfig');

const makeError = (code, message, status = null) => Object.assign(new Error(message), {
  code,
  status,
  upstreamStatus: status,
});

const buildHeaders = ({ auth = 'service', authorization } = {}) => {
  const headers = { 'Content-Type': 'application/json' };

  if (auth === 'service') {
    const apiKey = config.getApiKey();
    if (!apiKey) throw makeError('AI_SERVICE_UNAVAILABLE', 'AI service is not configured');
    headers['X-Service-Key'] = apiKey;
  } else if (auth === 'bearer') {
    const token = String(authorization || '').trim();
    if (!token) throw makeError('AI_SERVICE_UNAVAILABLE', 'AI service is not configured');
    headers.Authorization = /^Bearer\s/i.test(token) ? token : `Bearer ${token}`;
  }

  return headers;
};

const requestJson = async (method, path, body, options = {}) => {
  if (!config.isEnabled()) throw makeError('AI_SERVICE_UNAVAILABLE', 'AI service is unavailable');

  const baseUrl = config.getBaseUrl();
  if (!baseUrl || typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw makeError('AI_SERVICE_UNAVAILABLE', 'AI service is not configured');
  }

  const timeout = config.getTimeoutMs(options.fallbackTimeoutMs, options.timeoutEnvKey);
  let response;
  try {
    const url = `${baseUrl}${path}`;
    const requestOptions = {
      timeout: options.timeoutMs || timeout,
      headers: buildHeaders(options),
      maxBodyLength: options.maxBodyLength || 2_000_000,
      maxContentLength: options.maxContentLength || 2_000_000,
    };

    if (method === 'GET') response = await axios.get(url, requestOptions);
    else if (method === 'DELETE') response = await axios.delete(url, requestOptions);
    else if (method === 'POST') response = await axios.post(url, body, requestOptions);
    else throw makeError('AI_SERVICE_UNAVAILABLE', 'AI service request is unavailable');
  } catch (error) {
    if (error.code === 'AI_SERVICE_UNAVAILABLE') throw error;
    const status = Number.isInteger(error.response?.status) ? error.response.status : null;
    throw Object.assign(makeError('AI_SERVICE_UNAVAILABLE', 'AI service request failed', status), {
      retryable: status === null || status >= 500,
    });
  }

  if (!response || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI service returned an invalid response', response?.status || null);
  }
  return response.data;
};

const postJson = (path, body, options = {}) => requestJson('POST', path, body, options);
const getJson = (path, options = {}) => requestJson('GET', path, undefined, options);
const deleteJson = (path, options = {}) => requestJson('DELETE', path, undefined, options);

module.exports = { deleteJson, getJson, makeError, postJson, requestJson };
