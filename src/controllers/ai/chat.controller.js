// src/controllers/ai/chat.controller.js
const ChatThread = require('../../models/ChatThread');
const ChatMessage = require('../../models/ChatMessage');
const aiClient = require('../../services/ai/aiChatbotClient.service');

// 1. إنشاء محادثة جديدة
exports.createThread = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ تعديل: استخدام _id بدلاً من id
    const { title } = req.body;

    // الخطوة 1: استدعاء خدمة الـ AI لإنشاء thread
    const aiResponse = await aiClient.createAiThread(req.headers.authorization, title);
    
    // افترض أن الرد يحتوي على threadId
    const aiThreadId = aiResponse.data?.threadId || aiResponse.threadId;
    
    if (!aiThreadId) {
      throw new Error('The thread ID was not returned from the AI service');
    }

    // الخطوة 2: حفظ thread في قاعدة البيانات الخاصة بك
    const newThread = await ChatThread.create({
      user_id: userId,
      title: title || 'New thread',
      ai_thread_id: aiThreadId,
    });

    res.status(201).json({
      success: true,
      data: {
        threadId: newThread._id,
        aiThreadId: aiThreadId,
        title: newThread.title,
        createdAt: newThread.created_at,
      }
    });
  } catch (error) {
    console.error('❌ Error creating thread:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'failed to create thread, please try again'
    });
  }
};

// 2. جلب قائمة المحادثات
exports.listThreads = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ تعديل: استخدام _id بدلاً من id
    
    // جلب من قاعدة البيانات الخاصة بك
    const threads = await ChatThread.find({ user_id: userId })
      .sort({ updated_at: -1 })
      .select('_id title ai_thread_id updated_at');

    // جلب آخر رسالة لكل thread
    const threadsWithLastMessage = await Promise.all(threads.map(async (thread) => {
      const lastMessage = await ChatMessage.findOne({ thread_id: thread._id })
        .sort({ created_at: -1 })
        .select('content');
      
      return {
        id: thread._id,
        title: thread.title,
        updatedAt: thread.updated_at,
        lastMessage: lastMessage?.content || 'New conversation',
      };
    }));

    res.json({
      success: true,
      data: threadsWithLastMessage,
    });
  } catch (error) {
    console.error('❌ Error listing threads:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'failed to list threads, please try again' 
    });
  }
};

// 3. جلب رسائل محادثة محددة
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ تعديل: استخدام _id بدلاً من id
    const { threadId } = req.params;

    // التحقق من ملكية المحادثة
    const thread = await ChatThread.findOne({ _id: threadId, user_id: userId });
    if (!thread) {
      return res.status(403).json({ 
        success: false, 
        message: 'you are not authorized to access this thread' 
      });
    }

    // جلب الرسائل من قاعدة البيانات الخاصة بك
    const messages = await ChatMessage.find({ thread_id: threadId })
      .sort({ created_at: 1 })
      .select('role content created_at');

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('❌ Error getting messages:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'failed to get messages, please try again' 
    });
  }
};

// 4. إرسال رسالة والحصول على رد
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ تعديل: استخدام _id بدلاً من id
    const { threadId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'please enter a message'
      });
    }

    // 1. التحقق من ملكية المحادثة
    const thread = await ChatThread.findOne({ _id: threadId, user_id: userId });
    if (!thread) {
      return res.status(403).json({
        success: false,
        message: 'you are not authorized to send messages in this thread'
      });
    }

    // 2. حفظ رسالة المستخدم في قاعدة البيانات
    await ChatMessage.create({
      thread_id: threadId,
      role: 'user',
      content: content.trim(),
    });

    // 3. إرسال الرسالة إلى خدمة الـ AI
    const aiResponse = await aiClient.sendAiMessage(
      req.headers.authorization,
      thread.ai_thread_id,
      content.trim()
    );

    // استخراج محتوى الرد من استجابة الـ AI
    const assistantContent = aiResponse.data?.message?.content || 
                           aiResponse.message?.content || 
                           'Sorry, I couldn\'t process your request';

    // 4. حفظ رد الـ AI في قاعدة البيانات
    const assistantMessage = await ChatMessage.create({
      thread_id: threadId,
      role: 'assistant',
      content: assistantContent,
      ai_message_id: aiResponse.data?.message?.id || aiResponse.message?.id || null,
    });

    // 5. تحديث وقت آخر تحديث للمحادثة
    await ChatThread.findByIdAndUpdate(threadId, { updated_at: new Date() });

    res.json({
      success: true,
      data: {
        message: {
          id: assistantMessage._id,
          role: 'assistant',
          content: assistantMessage.content,
          createdAt: assistantMessage.created_at,
        }
      }
    });
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    res.status(500).json({
      success: false,
      message: 'failed to send message, please try again'
    });
  }
};

// 5. حذف محادثة
exports.deleteThread = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ تعديل: استخدام _id بدلاً من id
    const { threadId } = req.params;

    // التحقق من الملكية
    const thread = await ChatThread.findOne({ _id: threadId, user_id: userId });
    if (!thread) {
      return res.status(403).json({
        success: false,
        message: 'you are not authorized to delete this thread'
      });
    }

    // 1. حذف من خدمة الـ AI
    await aiClient.deleteAiThread(req.headers.authorization, thread.ai_thread_id);
    
    // 2. Delete associated messages locally
    await ChatMessage.deleteMany({ thread_id: threadId });
    // 3. حذف من قاعدة بياناتك (سيتم حذف الرسائل تلقائياً بسبب cascade)
    await ChatThread.findByIdAndDelete(threadId);

    res.json({ 
      success: true, 
      message: 'thread deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting thread:', error.message);
    res.status(500).json({
      success: false,
      message: 'failed to delete the thread. Please try again.'
    });
  }
};