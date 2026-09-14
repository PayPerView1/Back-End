// src/services/ai/aiChatbotClient.service.js
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://payperview-ai.onrender.com';

class AIChatbotClient {
  constructor() {
    this.client = axios.create({
      baseURL: AI_SERVICE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 100000, // 100 ثانية مهلة
    });
  }

  // دالة مساعدة لإعادة المحاولة في حال فشل الطلب
  async callWithRetry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && error.response?.status >= 500) {
        console.log(`🔄 إعادة المحاولة... (${retries} محاولات متبقية)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // 1. إنشاء محادثة جديدة في خدمة الـ AI
  async createAiThread(userToken, title) {
    return this.callWithRetry(async () => {
      const response = await this.client.post('/api/v1/ai/threads', 
        { title: title || '' },
        { headers: { Authorization: `${userToken}` } }
      );
      return response.data;
    });
  }

  // 2. جلب قائمة المحادثات من خدمة الـ AI
  async listAiThreads(userToken) {
    return this.callWithRetry(async () => {
      const response = await this.client.get('/api/v1/ai/threads', {
        headers: { Authorization: `${userToken}` }
      });
      return response.data;
    });
  }

  // 3. جلب رسائل محادثة محددة من خدمة الـ AI
  async getAiMessages(userToken, threadId) {
    return this.callWithRetry(async () => {
      const response = await this.client.get(`/api/v1/ai/threads/${threadId}/messages`, {
        headers: { Authorization: `${userToken}` }
      });
      return response.data;
    });
  }

  // 4. إرسال رسالة إلى خدمة الـ AI والحصول على رد
  async sendAiMessage(userToken, threadId, content) {
    return this.callWithRetry(async () => {
      const response = await this.client.post(`/api/v1/ai/threads/${threadId}/messages`, 
        { content },
        { headers: { Authorization: `${userToken}` } }
      );
      return response.data;
    });
  }

  // 5. حذف محادثة من خدمة الـ AI
  async deleteAiThread(userToken, threadId) {
    return this.callWithRetry(async () => {
      await this.client.delete(`/api/v1/ai/threads/${threadId}`, {
        headers: { Authorization: `${userToken}` }
      });
    });
  }

  // 6. (اختياري) استخدام الـ Legacy RAG Chat
  async legacyRagChat(userToken, message) {
    return this.callWithRetry(async () => {
      const response = await this.client.post('/api/v1/chat',
        { message },
        { headers: { Authorization: ` ${userToken}` } }
      );
      return response.data;
    });
  }
}

module.exports = new AIChatbotClient();