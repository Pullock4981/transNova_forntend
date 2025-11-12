const User = require('../models/User');

/**
 * Get current user profile
 * GET /users/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('savedJobs')
      .populate('savedResources');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update user profile
 * PUT /users/me
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      educationLevel,
      experienceLevel,
      preferredTrack,
      experiences,
      careerInterests,
      cvText,
    } = req.body;

    // Find user
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update user profile
    if (fullName) user.fullName = fullName;
    if (educationLevel !== undefined) user.educationLevel = educationLevel;
    if (experienceLevel) user.experienceLevel = experienceLevel;
    if (preferredTrack !== undefined) user.preferredTrack = preferredTrack;
    if (experiences) user.experiences = experiences;
    if (careerInterests) user.careerInterests = careerInterests;
    if (cvText !== undefined) user.cvText = cvText;

    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user skills
 * PATCH /users/me/skills
 */
const updateSkills = async (req, res, next) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: 'Skills must be an array',
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.skills = skills;
    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user career interests
 * PATCH /users/me/interests
 */
const updateInterests = async (req, res, next) => {
  try {
    const { careerInterests } = req.body;

    if (!Array.isArray(careerInterests)) {
      return res.status(400).json({
        success: false,
        message: 'Career interests must be an array',
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.careerInterests = careerInterests;
    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Store CV text
 * POST /users/me/cv
 */
const storeCV = async (req, res, next) => {
  try {
    const { cvText } = req.body;

    if (cvText === undefined) {
      return res.status(400).json({
        success: false,
        message: 'CV text is required',
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.cvText = cvText;
    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save a job
 * POST /users/me/save-job/:jobId
 */
const saveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if job is already saved
    if (!user.savedJobs.includes(jobId)) {
      user.savedJobs.push(jobId);
      await user.save();
    }

    const updatedUser = await User.findById(user._id).populate('savedJobs');

    res.status(200).json({
      success: true,
      data: updatedUser.savedJobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save a resource
 * POST /users/me/save-resource/:resourceId
 */
const saveResource = async (req, res, next) => {
  try {
    const { resourceId } = req.params;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if resource is already saved
    if (!user.savedResources.includes(resourceId)) {
      user.savedResources.push(resourceId);
      await user.save();
    }

    const updatedUser = await User.findById(user._id).populate('savedResources');

    res.status(200).json({
      success: true,
      data: updatedUser.savedResources,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentUser,
  updateUserProfile,
  updateSkills,
  updateInterests,
  storeCV,
  saveJob,
  saveResource,
};

