const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    experienceLevel: {
      type: String,
      required: true,
      trim: true,
    },
    jobType: {
      type: String,
      enum: ['Internship', 'Part-time', 'Full-time', 'Freelance'],
      required: true,
    },
    track: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      default: 'manual',
      enum: ['manual', 'bdjobs.com', 'other'],
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster filtering
jobSchema.index({ track: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ experienceLevel: 1 });

module.exports = mongoose.model('Job', jobSchema);

