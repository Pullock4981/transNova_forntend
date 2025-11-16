const Job = require('../models/Job');
const User = require('../models/User');
const aiJobMatchingService = require('../services/aiJobMatchingService');

/**
 * Local Job Recommendation Agent
 * 
 * Purpose: Provides job recommendations from bdjobs.com (local jobs)
 *          based on user profile, skills, and career goals
 * 
 * Responsibilities:
 * - Filters jobs from bdjobs.com (source: 'bdjobs.com')
 * - Matches jobs to user profile using AI-powered matching
 * - Returns jobs with bdjobs.com links (sourceUrl)
 * - Optimized for fast response times
 * 
 * Usage:
 *   const agent = require('./agents/localJobRecommendationAgent');
 *   const recommendations = await agent.getLocalJobRecommendations(userId);
 */
class LocalJobRecommendationAgent {
  /**
   * Get local job recommendations from bdjobs.com for a user
   * OPTIMIZED: Fast exact matching with optional AI enhancement
   * 
   * @param {String} userId - User's MongoDB _id
   * @returns {Array} Array of recommended local jobs with match details
   */
  async getLocalJobRecommendations(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) {
        console.log('⚠️  User not found for local job recommendations');
        return [];
      }

      // OPTIMIZATION: Filter only bdjobs.com jobs and use lean() for faster queries
      const localJobs = await Job.find({
        source: 'bdjobs.com', // Only bdjobs.com jobs
        sourceUrl: { $exists: true, $ne: '' }, // Must have bdjobs.com link
      })
        .select('title company location requiredSkills experienceLevel jobType track email source sourceUrl')
        .lean()
        .limit(50); // Limit to 50 jobs max

      if (localJobs.length === 0) {
        console.log('⚠️  No bdjobs.com jobs found in database.');
        return [];
      }

      console.log(`📊 Fetched ${localJobs.length} local jobs from bdjobs.com`);

      // If user has no skills, still return jobs (just with lower match scores)
      if (!user.skills || user.skills.length === 0) {
        console.log('⚠️  User has no skills, returning all local jobs with basic matching');
        return localJobs.slice(0, 20).map(job => ({
          jobId: job._id,
          job: {
            ...job,
            sourceUrl: job.sourceUrl || '',
            source: 'bdjobs.com',
          },
          matchedSkills: [],
          matchScore: 0.1, // Low score for jobs without skill matches
          matchPercentage: 10,
        }));
      }

      // Use AI-powered matching service (fast rule-based for dashboard)
      try {
        const recommendations = await aiJobMatchingService.analyzeMultipleJobs(user, localJobs);
        
        // Ensure all recommendations have matchPercentage and include sourceUrl
        return recommendations.map(rec => {
          // Find the original job to get sourceUrl
          const originalJob = localJobs.find(j => 
            (j._id && rec.job?._id && j._id.toString() === rec.job._id.toString()) ||
            (j.title === rec.job?.title && j.company === rec.job?.company)
          );

          if (rec.matchPercentage === undefined || rec.matchPercentage === null) {
            if (rec.matchScore !== undefined) {
              rec.matchPercentage = Math.round(rec.matchScore * 100);
            } else if (rec.matchedSkills && rec.job?.requiredSkills) {
              const baseScore = rec.matchedSkills.length / rec.job.requiredSkills.length;
              rec.matchPercentage = Math.round(baseScore * 100);
            } else {
              rec.matchPercentage = 0;
            }
          }

          // Include sourceUrl from original job
          return {
            ...rec,
            job: {
              ...rec.job,
              sourceUrl: originalJob?.sourceUrl || rec.job?.sourceUrl || '',
              source: 'bdjobs.com',
            },
          };
        });
      } catch (aiError) {
        console.error('AI matching failed for local jobs, falling back to rule-based:', aiError.message);
        // Fallback to rule-based matching if AI fails
        return this.getLocalJobRecommendationsFallback(user, localJobs);
      }
    } catch (error) {
      console.error('Error in getLocalJobRecommendations:', error);
      // Return empty array instead of throwing - graceful degradation
      return [];
    }
  }

  /**
   * Fallback rule-based local job matching (used when AI fails)
   * OPTIMIZED: Fast exact matching with Set-based lookups
   * @param {Object} user - User object
   * @param {Array} localJobs - Array of bdjobs.com jobs
   * @returns {Array} Array of recommended local jobs
   */
  getLocalJobRecommendationsFallback(user, localJobs) {
    try {
      // OPTIMIZATION: Pre-process user skills into Set for O(1) lookup
      const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
      const userInterests = (user.careerInterests || []).map(s => s.toLowerCase().trim());
      const allUserItemsSet = new Set([...userSkills, ...userInterests]);
      const allUserItemsArray = [...userSkills, ...userInterests];

      const userTrack = (user.preferredTrack || '').toLowerCase();
      const userExperience = (user.experienceLevel || 'Fresher').toLowerCase();

      const recommendations = localJobs
        .map(job => {
          // Calculate matched skills
          const matchedSkills = (job.requiredSkills || []).filter(skill => {
            const skillLower = skill.toLowerCase().trim();
            
            // OPTIMIZATION: Set lookup first (fastest)
            if (allUserItemsSet.has(skillLower)) {
              return true;
            }
            
            // Substring matching (only if needed)
            return allUserItemsArray.some(userItem => 
              userItem.includes(skillLower) ||
              skillLower.includes(userItem)
            );
          });

          // Calculate match score
          let matchScore = 0;
          if (job.requiredSkills && job.requiredSkills.length > 0) {
            matchScore = matchedSkills.length / job.requiredSkills.length;
          }

          // Boost score for track match
          const jobTrack = (job.track || '').toLowerCase();
          if (userTrack && jobTrack.includes(userTrack)) {
            matchScore += 0.2;
          }

          // Boost score for experience match
          const jobExperience = (job.experienceLevel || '').toLowerCase();
          if (userExperience === jobExperience) {
            matchScore += 0.1;
          }

          // Only include jobs with at least one match
          if (matchedSkills.length === 0 && matchScore < 0.1) {
            return null;
          }

          return {
            jobId: job._id,
            job: {
              ...job,
              sourceUrl: job.sourceUrl || '',
              source: 'bdjobs.com',
            },
            matchedSkills,
            matchScore: Math.min(matchScore, 1.0),
            matchPercentage: Math.round(Math.min(matchScore, 1.0) * 100),
          };
        })
        .filter(Boolean) // Remove null entries
        .sort((a, b) => b.matchScore - a.matchScore) // Sort by match score
        .slice(0, 20); // Return top 20

      return recommendations;
    } catch (error) {
      console.error('Error in getLocalJobRecommendationsFallback:', error);
      return [];
    }
  }
}

module.exports = new LocalJobRecommendationAgent();

