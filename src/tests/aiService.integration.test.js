const integrationEnabled = process.env.AI_SERVICE_INTEGRATION === 'true';
if (integrationEnabled) require('dotenv').config();

const aiIntelligence = require('../services/ai/aiIntelligence.client');
const transport = require('../services/ai/aiServiceTransport');

const liveTest = integrationEnabled ? test : test.skip;

describe('live AI Service integration', () => {
  liveTest('health and readiness endpoints are reachable', async () => {
    const health = await transport.getJson('/health', { auth: 'none', timeoutMs: 5000 });
    const readiness = await transport.getJson('/ready', { auth: 'none', timeoutMs: 5000 });

    expect(health.status).toBe('ok');
    expect(readiness.status).toBe('configuration_ready');
    expect(readiness.checks).toMatchObject({
      gemini_configured: true,
      jwt_configured: true,
      backend_configured: true,
      service_key_configured: true,
      chroma_ready: true,
    });
  });

  liveTest('the shared service key and language response contract work against the live service', async () => {
    const response = await aiIntelligence.detectLanguage({ text: 'مرحبا' });

    expect(response).toMatchObject({
      language: 'ar',
      method: 'UNICODE_SCRIPT_HEURISTIC',
    });
    expect(response.confidence).toBeGreaterThan(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });
});
