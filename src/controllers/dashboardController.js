const User = require('../models/User');
const {
  getJobRecommendations,
  getResourceRecommendations,
} = require('../services/recommendationService');

/**
 * Get dashboard data for current user
 * GET /dashboard
 * Returns: user profile, recommended jobs, recommended resources, saved items
 */
const getDashboard = async (req, res, next) => {
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

    // Get recommendations
    const recommendedJobs = await getJobRecommendations(user._id);
    const recommendedResources = await getResourceRecommendations(user._id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          educationLevel: user.educationLevel,
          experienceLevel: user.experienceLevel,
          preferredTrack: user.preferredTrack,
          skills: user.skills,
          careerInterests: user.careerInterests,
        },
        recommendedJobs: {
          count: recommendedJobs.length,
          jobs: recommendedJobs,
        },
        recommendedResources: {
          count: recommendedResources.length,
          resources: recommendedResources,
        },
        savedJobs: user.savedJobs,
        savedResources: user.savedResources,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
};

