const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
conversationSchema.index({ userId: 1, lastMessageAt: -1 });

// Method to add a message
conversationSchema.methods.addMessage = function(role, content) {
  this.messages.push({
    role,
    content,
    timestamp: new Date(),
  });
  this.lastMessageAt = new Date();
  return this.save();
};

// Method to get recent messages (for context)
conversationSchema.methods.getRecentMessages = function(limit = 20) {
  return this.messages.slice(-limit);
};

module.exports = mongoose.model('Conversation', conversationSchema);

