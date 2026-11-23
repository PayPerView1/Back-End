const chatHistoryService = require('../../services/ai/chatHistory.service');
const { sendError } = require('../../utils/errors');

exports.createThread = async (req, res) => {
  try {
    const data = await chatHistoryService.createThread(
      req.user._id,
      req.get('authorization'),
      req.validated.body.title
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'chat.createThread');
  }
};

exports.listThreads = async (req, res) => {
  try {
    const data = await chatHistoryService.listThreads(req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'chat.listThreads');
  }
};

exports.getMessages = async (req, res) => {
  try {
    const data = await chatHistoryService.getMessages(req.validated.params.threadId, req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'chat.getMessages');
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const data = await chatHistoryService.sendMessage(
      req.validated.params.threadId,
      req.user._id,
      req.get('authorization'),
      req.validated.body.content
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'chat.sendMessage');
  }
};

exports.deleteThread = async (req, res) => {
  try {
    await chatHistoryService.deleteThread(
      req.validated.params.threadId,
      req.user._id,
      req.get('authorization')
    );
    return res.status(200).json({ success: true, message: 'thread deleted successfully' });
  } catch (error) {
    return sendError(res, error, 'chat.deleteThread');
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const data = await chatHistoryService.submitFeedback(
      req.validated.params.threadId,
      req.validated.params.messageId,
      req.user._id,
      req.validated.body
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'chat.submitFeedback');
  }
};
