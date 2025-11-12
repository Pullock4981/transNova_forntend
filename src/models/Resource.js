const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    relatedSkills: {
      type: [String],
      default: [],
    },
    cost: {
      type: String,
      enum: ['Free', 'Paid'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
resourceSchema.index({ relatedSkills: 1 });
resourceSchema.index({ cost: 1 });

module.exports = mongoose.model('Resource', resourceSchema);

