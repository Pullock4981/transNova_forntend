const User = require('../models/User');
const {
  getJobRecommendations,
  getResourceRecommendations,
  getLocalJobRecommendations,
} = require('../services/recommendationService');

/**
 * Get dashboard data for current user
 * GET /dashboard
 * Returns: user profile, recommended jobs, recommended resources, saved items
 * OPTIMIZED: Parallel fetching, single user query, optimized queries
 */
const getDashboard = async (req, res, next) => {
  try {
    // OPTIMIZATION 1: Fetch user with optimized query (single fetch, no duplicates)
    // Use .select() to only fetch needed fields, .lean() for faster queries, specific populate fields
    const user = await User.findById(req.user.userId)
      .select('_id fullName email educationLevel experienceLevel preferredTrack skills careerInterests savedJobs appliedJobs savedResources')
      .populate('savedJobs', 'title company location requiredSkills experienceLevel jobType track email')
      .populate('appliedJobs', 'title company location requiredSkills experienceLevel jobType track email')
      .populate('savedResources', 'title platform type cost relatedSkills description url')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    // OPTIMIZATION 2: Parallel fetching of recommendations (much faster than sequential)
    // Pass user object to avoid duplicate database queries
    const [recommendedJobs, recommendedResources, localJobs] = await Promise.all([
      getJobRecommendations(user._id, user).catch(err => {
        console.error('Error getting job recommendations:', err.message);
        return [];
      }),
      getResourceRecommendations(user._id, user).catch(err => {
        console.error('Error getting resource recommendations:', err.message);
        return [];
      }),
      getLocalJobRecommendations(user._id, user).catch(err => {
        console.error('Error getting local job recommendations:', err.message);
        return [];
      }),
    ]);
    
    // Ensure all recommendations have matchPercentage
    const processedJobs = recommendedJobs.map(rec => {
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
          appliedJobs: user.appliedJobs || [],
        },
        recommendedJobs: {
          count: recommendedJobs.length,
          jobs: recommendedJobs,
        },
        recommendedResources: {
          count: recommendedResources.length,
          resources: recommendedResources,
        },
        localJobs: {
          count: localJobs.length,
          jobs: localJobs,
        },
        savedJobs: user.savedJobs || [],
        appliedJobs: user.appliedJobs || [],
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

