const mongoose = require('mongoose');
const ChatThread = require('../../models/ChatThread');
const ChatMessage = require('../../models/ChatMessage');
const aiClient = require('./aiChatbotClient.service');
const { AppError } = require('../../utils/errors');

const toUpstreamError = (error) => {
  const status = error.status || error.upstreamStatus || null;
  const code = error.code === 'AI_SERVICE_BAD_RESPONSE' || (status && status < 500)
    ? 'AI_SERVICE_BAD_RESPONSE'
    : 'AI_SERVICE_UNAVAILABLE';
  console.error(`[chatHistory] AI request failed: status=${status || 'network'}`);
  return new AppError('The AI assistant is temporarily unavailable', code);
};

const ownedThread = async (threadId, userId) => {
  const thread = await ChatThread.findOne({ _id: threadId, user_id: userId });
  if (!thread) throw new AppError('Conversation not found', 'NOT_FOUND');
  return thread;
};

const createThread = async (userId, authorization, title) => {
  let aiThreadId;
  try {
    const aiResponse = await aiClient.createAiThread(authorization, title);
    aiThreadId = aiResponse?.data?.threadId || aiResponse?.threadId;
    if (typeof aiThreadId !== 'string' || !aiThreadId.trim()) {
      throw new AppError('The AI service returned an invalid conversation', 'AI_SERVICE_BAD_RESPONSE');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toUpstreamError(error);
  }

  try {
    const thread = await ChatThread.create({
      user_id: userId,
      title: title || 'New thread',
      ai_thread_id: aiThreadId,
    });
    return {
      threadId: thread._id,
      aiThreadId,
      title: thread.title,
      createdAt: thread.created_at,
    };
  } catch (error) {
    try {
      await aiClient.deleteAiThread(authorization, aiThreadId);
    } catch (cleanupError) {
      console.error('[chatHistory] AI thread compensation failed');
    }
    throw error;
  }
};

const listThreads = async (userId) => {
  const threads = await ChatThread.find({ user_id: userId })
    .sort({ updated_at: -1 })
    .select('_id title updated_at')
    .lean();
  if (!threads.length) return [];

  const lastMessages = await ChatMessage.aggregate([
    { $match: { thread_id: { $in: threads.map((thread) => thread._id) } } },
    { $sort: { created_at: -1 } },
    { $group: { _id: '$thread_id', content: { $first: '$content' } } },
  ]);
  const lastByThread = new Map(lastMessages.map((message) => [String(message._id), message.content]));

  return threads.map((thread) => ({
    id: thread._id,
    title: thread.title,
    updatedAt: thread.updated_at,
    lastMessage: lastByThread.get(String(thread._id)) || 'New conversation',
  }));
};

const getMessages = async (threadId, userId) => {
  await ownedThread(threadId, userId);
  const messages = await ChatMessage.find({ thread_id: threadId })
    .sort({ created_at: 1 })
    .select('_id role content created_at feedback metadata')
    .lean();
  return messages.map((message) => ({
    id: message._id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
    feedback: message.feedback || null,
    language: message.metadata?.get?.('language') || message.metadata?.language || null,
    suggestedActions: message.metadata?.get?.('suggestedActions') || message.metadata?.suggestedActions || [],
  }));
};

const sendMessage = async (threadId, userId, authorization, content) => {
  const thread = await ownedThread(threadId, userId);
  const priorFeedback = await ChatMessage.find({ thread_id: thread._id, role: 'assistant', feedback: { $ne: null } })
    .sort({ created_at: -1 }).limit(10).select('feedback.rating').lean();
  const negative = priorFeedback.filter((item) => item.feedback?.rating === 'NOT_HELPFUL').length;
  const positive = priorFeedback.filter((item) => item.feedback?.rating === 'HELPFUL').length;
  const responsePreference = negative > positive ? 'MORE_CONCISE' : 'NEUTRAL';
  let aiResponse;
  try {
    aiResponse = await aiClient.sendAiMessage(authorization, thread.ai_thread_id, content, responsePreference);
  } catch (error) {
    throw toUpstreamError(error);
  }

  const aiMessage = aiResponse?.data?.message || aiResponse?.message;
  if (!aiMessage || typeof aiMessage.content !== 'string' || !aiMessage.content.trim()) {
    throw new AppError('The AI service returned an invalid message', 'AI_SERVICE_BAD_RESPONSE');
  }

  let assistantMessage;
  const saveChatData = async (opts = {}) => {
    const createOptions = opts.session ? { ...opts, ordered: true } : opts;
    const messages = await ChatMessage.create([
      { thread_id: thread._id, role: 'user', content },
      {
        thread_id: thread._id,
        role: 'assistant',
        content: aiMessage.content.trim(),
        ai_message_id: aiMessage.id || null,
        metadata: {
          language: aiMessage.language || null,
          suggestedActions: Array.isArray(aiMessage.suggestedActions) ? aiMessage.suggestedActions.slice(0, 5) : [],
        },
      },
    ], createOptions);
    assistantMessage = messages[1];
    await ChatThread.updateOne(
      { _id: thread._id, user_id: userId },
      { $set: { updated_at: new Date() } },
      opts
    );
  };

  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await saveChatData({ session });
      });
    } finally {
      await session.endSession();
    }
  } catch (err) {
    if (err.message && err.message.includes('replica set')) {
      await saveChatData();
    } else {
      throw err;
    }
  }

  return {
    message: {
      id: assistantMessage._id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      createdAt: assistantMessage.created_at,
      language: aiMessage.language || null,
      suggestedActions: Array.isArray(aiMessage.suggestedActions) ? aiMessage.suggestedActions.slice(0, 5) : [],
    },
  };
};

const deleteThread = async (threadId, userId, authorization) => {
  const thread = await ownedThread(threadId, userId);
  try {
    await aiClient.deleteAiThread(authorization, thread.ai_thread_id);
  } catch (error) {
    throw toUpstreamError(error);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await ChatMessage.deleteMany({ thread_id: thread._id }, { session });
      await ChatThread.deleteOne({ _id: thread._id, user_id: userId }, { session });
    });
  } finally {
    await session.endSession();
  }
};

const submitFeedback = async (threadId, messageId, userId, { rating, comment }) => {
  await ownedThread(threadId, userId);
  const message = await ChatMessage.findOneAndUpdate(
    { _id: messageId, thread_id: threadId, role: 'assistant' },
    { $set: { feedback: { rating, comment: comment || '', submittedAt: new Date() } } },
    { new: true, runValidators: true }
  ).select('_id feedback');
  if (!message) throw new AppError('Assistant message not found', 'NOT_FOUND');
  return { messageId: message._id, feedback: message.feedback };
};

module.exports = { createThread, listThreads, getMessages, sendMessage, deleteThread, submitFeedback };
