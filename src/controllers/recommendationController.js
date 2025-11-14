const {
  getJobRecommendations,
  getResourceRecommendations,
} = require('../services/recommendationService');
const User = require('../models/User');

/**
 * Get job recommendations for current user
 * GET /recommendations/jobs
 */
const getRecommendedJobs = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const recommendations = await getJobRecommendations(user._id);

    // Ensure all recommendations have matchPercentage
    const recommendationsWithPercentage = recommendations.map(rec => {
      if (rec.matchPercentage === undefined || rec.matchPercentage === null) {
        // Calculate from matchScore if available
        if (rec.matchScore !== undefined) {
          rec.matchPercentage = Math.round(rec.matchScore * 100);
        } else if (rec.matchedSkills && rec.job?.requiredSkills) {
          // Fallback calculation
          const baseScore = rec.matchedSkills.length / rec.job.requiredSkills.length;
          rec.matchPercentage = Math.round(baseScore * 100);
        } else {
          rec.matchPercentage = 0;
        }
      }
      return rec;
    });

    res.status(200).json({
      success: true,
      count: recommendationsWithPercentage.length,
      data: recommendationsWithPercentage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get learning resource recommendations for current user
 * GET /recommendations/resources
 */
const getRecommendedResources = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const recommendations = await getResourceRecommendations(user._id);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecommendedJobs,
  getRecommendedResources,
};

