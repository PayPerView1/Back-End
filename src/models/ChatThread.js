// src/models/ChatThread.js
const mongoose = require('mongoose');

const chatThreadSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: 'محادثة جديدة',
    trim: true,
    maxlength: 255,
  },
  // هذا الحقل سيتم ربطه مع thread_id من خدمة الـ AI
  ai_thread_id: {
    type: String, // UUID من خدمة زميلك
    required: true,
    unique: true,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// فهارس للبحث السريع
chatThreadSchema.index({ user_id: 1, updated_at: -1 });

module.exports = mongoose.model('ChatThread', chatThreadSchema);
// const mongoose = require('mongoose');

// const chatThreadSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//       index: true,
//     },
//     title: {
//       type: String,
//       trim: true,
//       default: 'New Conversation',
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Composite index for fast sorting per user
// chatThreadSchema.index({ userId: 1, updatedAt: -1 });

// module.exports = mongoose.model('ChatThread', chatThreadSchema);