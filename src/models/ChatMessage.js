// src/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  thread_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatThread',
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  ai_message_id: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: { createdAt: 'created_at' }
});

// فهارس
chatMessageSchema.index({ thread_id: 1, created_at: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
// const mongoose = require('mongoose');

// const chatMessageSchema = new mongoose.Schema(
//   {
//     threadId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'ChatThread',
//       required: true,
//       index: true,
//     },
//     role: {
//       type: String,
//       enum: ['user', 'assistant'],
//       required: true,
//     },
//     content: {
//       type: String,
//       required: true,
//     },
//     metadata: {
//       type: mongoose.Schema.Types.Mixed,
//       default: {},
//     },
//   },
//   {
//     timestamps: { createdAt: true, updatedAt: false },
//   }
// );

// // Index for loading conversation history in chronological order
// chatMessageSchema.index({ threadId: 1, createdAt: 1 });

// module.exports = mongoose.model('ChatMessage', chatMessageSchema);