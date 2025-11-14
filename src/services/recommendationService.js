const Job = require('../models/Job');
const Resource = require('../models/Resource');
const User = require('../models/User');

/**
 * Get job recommendations based on user skills
 * Rule-based matching algorithm
 * @param {string} userId - User's MongoDB _id
 * @returns {Array} Array of recommended jobs with match details
 */
const getJobRecommendations = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user || !user.skills || user.skills.length === 0) {
      return [];
    }

    const allJobs = await Job.find();

    const recommendations = allJobs
      .map((job) => {
        // Find matching skills (case-insensitive)
        const matchedSkills = user.skills.filter((userSkill) =>
          job.requiredSkills.some(
            (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
          )
        );

        // Find missing skills
        const missingSkills = job.requiredSkills.filter(
          (jobSkill) =>
            !user.skills.some(
              (userSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
            )
        );

        // Only recommend if at least one skill matches
        if (matchedSkills.length > 0) {
          // Calculate base match score
          let matchScore = matchedSkills.length / job.requiredSkills.length;
          
          // Boost score if job track matches user's preferred track
          if (user.preferredTrack && job.track && 
              user.preferredTrack.toLowerCase() === job.track.toLowerCase()) {
            matchScore += 0.2; // Boost by 20% for track match
          }
          
          return {
            jobId: job._id,
            job: job,
            matchedSkills,
            missingSkills,
            matchScore: Math.min(matchScore, 1.0), // Cap at 1.0
          };
        }

        return null;
      })
      .filter((rec) => rec !== null)
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by match score descending

    return recommendations;
  } catch (error) {
    throw error;
  }
};

/**
 * Get learning resource recommendations based on user skills and interests
 * Rule-based matching algorithm
 * @param {string} userId - User's MongoDB _id
 * @returns {Array} Array of recommended resources
 */
const getResourceRecommendations = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return [];
    }

    // Combine user skills and career interests for matching
    const userSkillsAndInterests = [
      ...(user.skills || []),
      ...(user.careerInterests || []),
    ];

    if (userSkillsAndInterests.length === 0) {
      return [];
    }

    const allResources = await Resource.find();

    const recommendations = allResources
      .map((resource) => {
        // Find matching skills/interests (case-insensitive)
        const matchedItems = userSkillsAndInterests.filter((userItem) =>
          resource.relatedSkills.some(
            (resourceSkill) =>
              userItem.toLowerCase() === resourceSkill.toLowerCase()
          )
        );

        // Only recommend if at least one match
        if (matchedItems.length > 0) {
          return {
            resourceId: resource._id,
            resource: resource,
            matchedItems,
            matchScore: matchedItems.length / resource.relatedSkills.length,
          };
        }

        return null;
      })
      .filter((rec) => rec !== null)
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by match score descending

    return recommendations;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getJobRecommendations,
  getResourceRecommendations,
};

