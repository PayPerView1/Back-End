const transport = require('./aiServiceTransport');

const chatOptions = (authorization) => ({
  auth: 'bearer',
  authorization,
  fallbackTimeoutMs: 100000,
  timeoutEnvKey: 'AI_CHAT_TIMEOUT_MS',
});

class AIChatbotClient {
  async callWithRetry(fn, retries = 2, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      const status = error.status || error.upstreamStatus || null;
      if (retries <= 0 || error.retryable !== true || (status && status < 500)) throw error;
      console.warn(`[aiChatbotClient] retrying safe request (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.callWithRetry(fn, retries - 1, delay * 2);
    }
  }

  async createAiThread(userToken, title) {
    return transport.postJson('/api/v1/ai/threads', { title: title || '' }, chatOptions(userToken));
  }

  async listAiThreads(userToken) {
    return this.callWithRetry(
      () => transport.getJson('/api/v1/ai/threads', chatOptions(userToken)),
      2
    );
  }

  async getAiMessages(userToken, threadId) {
    const safeThreadId = encodeURIComponent(String(threadId));
    return this.callWithRetry(
      () => transport.getJson(`/api/v1/ai/threads/${safeThreadId}/messages`, chatOptions(userToken)),
      2
    );
  }

  async sendAiMessage(userToken, threadId, content, responsePreference = 'NEUTRAL') {
    const safeThreadId = encodeURIComponent(String(threadId));
    return transport.postJson(
      `/api/v1/ai/threads/${safeThreadId}/messages`,
      { content, responsePreference },
      chatOptions(userToken)
    );
  }

  async deleteAiThread(userToken, threadId) {
    const safeThreadId = encodeURIComponent(String(threadId));
    return transport.deleteJson(`/api/v1/ai/threads/${safeThreadId}`, chatOptions(userToken));
  }

  async legacyRagChat(userToken, message) {
    return transport.postJson('/api/v1/chat', { message }, chatOptions(userToken));
  }
}

module.exports = new AIChatbotClient();
