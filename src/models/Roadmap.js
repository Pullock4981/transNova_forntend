const mongoose = require('mongoose');

const roadmapSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetRole: {
      type: String,
      required: true,
    },
    timeframe: {
      type: Number,
      required: true,
      min: 1,
      max: 24,
    },
    phases: [
      {
        month: Number,
        title: String,
        objectives: [String],
        skillsToLearn: [String],
        projects: [
          {
            name: String,
            description: String,
            technologies: [String],
            difficulty: String,
          },
        ],
        milestones: [String],
        estimatedHours: Number,
      },
    ],
    applicationTimeline: String,
    portfolioTips: [String],
    interviewPrep: [String],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

roadmapSchema.index({ userId: 1, targetRole: 1 });

module.exports = mongoose.model('Roadmap', roadmapSchema);

