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

    // Get recommendations (will work even if ChromaDB fails)
    let recommendedJobs = [];
    let recommendedResources = [];
    
    try {
      recommendedJobs = await getJobRecommendations(user._id);
      
      // Ensure all recommendations have matchPercentage
      recommendedJobs = recommendedJobs.map(rec => {
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
    } catch (error) {
      console.error('Error getting job recommendations:', error.message);
      // Return empty array - graceful degradation
    }
    
    try {
      recommendedResources = await getResourceRecommendations(user._id);
    } catch (error) {
      console.error('Error getting resource recommendations:', error.message);
      // Return empty array - graceful degradation
    }

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

