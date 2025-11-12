const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Don't return password in queries by default
    },
    educationLevel: {
      type: String,
      default: '',
    },
    experienceLevel: {
      type: String,
      enum: ['Fresher', 'Junior', 'Mid'],
      default: 'Fresher',
    },
    preferredTrack: {
      type: String,
      default: '',
    },
    skills: {
      type: [String],
      default: [],
    },
    experiences: {
      type: [String],
      default: [],
    },
    careerInterests: {
      type: [String],
      default: [],
    },
    cvText: {
      type: String,
      default: '',
    },
    savedJobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
      },
    ],
    savedResources: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userSchema.index({ email: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash password if it's been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);

