const Job = require('../models/Job');
const Resource = require('../models/Resource');
const User = require('../models/User');
const chromaService = require('./chromaService');
const aiJobMatchingService = require('./aiJobMatchingService');
const resourceRecommendationAgent = require('../agents/resourceRecommendationAgent');
const localJobRecommendationAgent = require('../agents/localJobRecommendationAgent');

/**
 * Generate key reasons for job match
 * Format: "Matches React, JS, HTML; missing Redux and TypeScript"
 */
const generateKeyReasons = (matchedSkills, missingSkills, trackMatch, experienceMatch, userExp, jobExp) => {
  const reasons = [];
  
  // Primary reason: Combined skill matches and missing skills
  if (matchedSkills.length > 0 || missingSkills.length > 0) {
    let primaryReason = '';
    
    // Add matched skills
    if (matchedSkills.length > 0) {
      const topMatchedSkills = matchedSkills.slice(0, 5).join(', ');
      primaryReason = `Matches ${topMatchedSkills}`;
    }
    
    // Add missing skills
    if (missingSkills.length > 0) {
      const topMissingSkills = missingSkills.slice(0, 3).join(' and ');
      if (primaryReason) {
        primaryReason += `; missing ${topMissingSkills}`;
      } else {
        primaryReason = `Missing ${topMissingSkills}`;
      }
    }
    
    if (primaryReason) {
      reasons.push(primaryReason);
    }
  }
  
  // Track alignment (as secondary reason)
  if (trackMatch) {
    reasons.push('Perfect alignment with your preferred career track');
  }
  
  // Experience level (as secondary reason)
  if (experienceMatch) {
    reasons.push(`Your ${userExp} experience level meets the ${jobExp} requirement`);
  } else if (userExp && jobExp && userExp !== jobExp) {
    reasons.push(`Experience level: ${userExp} (job requires ${jobExp})`);
  }
  
  return reasons;
};

/**
 * Get application platforms based on job track and type
 */
const getApplicationPlatforms = (track, jobType) => {
  const platforms = [
    {
      name: 'LinkedIn',
      url: 'https://www.linkedin.com/jobs',
      icon: '💼',
      description: 'Professional networking and job search',
    },
    {
      name: 'BDjobs',
      url: 'https://www.bdjobs.com',
      icon: '🇧🇩',
      description: 'Bangladesh\'s leading job portal',
    },
    {
      name: 'Glassdoor',
      url: 'https://www.glassdoor.com/Job',
      icon: '🔍',
      description: 'Company reviews and job listings',
    },
  ];
  
  // Add track-specific platforms
  if (track && (track.toLowerCase().includes('software') || track.toLowerCase().includes('development'))) {
    platforms.push({
      name: 'Stack Overflow Jobs',
      url: 'https://stackoverflow.com/jobs',
      icon: '💻',
      description: 'Tech-focused job board',
    });
    platforms.push({
      name: 'GitHub Jobs',
      url: 'https://jobs.github.com',
      icon: '🐙',
      description: 'Developer job opportunities',
    });
  }
  
  if (track && (track.toLowerCase().includes('design') || track.toLowerCase().includes('ui'))) {
    platforms.push({
      name: 'Dribbble Jobs',
      url: 'https://dribbble.com/jobs',
      icon: '🎨',
      description: 'Design job board',
    });
  }
  
  if (jobType && jobType.toLowerCase() === 'remote') {
    platforms.push({
      name: 'Remote.co',
      url: 'https://remote.co',
      icon: '🌍',
      description: 'Remote job opportunities',
    });
    platforms.push({
      name: 'We Work Remotely',
      url: 'https://weworkremotely.com',
      icon: '🏠',
      description: 'Remote work jobs',
    });
  }
  
  return platforms;
};

/**
 * Get job recommendations with AI-powered intelligent matching
 * Uses Gemini API to analyze matches and generate match percentages, key reasons, and application platforms
 * @param {string} userId - User's MongoDB _id
 * @returns {Array} Array of recommended jobs with enhanced match details
 */
const getJobRecommendations = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user || !user.skills || user.skills.length === 0) {
      return [];
    }

    // OPTIMIZATION: Limit jobs fetched from database and only select needed fields
    // This reduces memory usage and query time
    const allJobs = await Job.find()
      .select('title company location requiredSkills experienceLevel jobType track') // Only needed fields
      .limit(50) // Limit to 50 jobs max (prevents processing too many)
      .lean(); // Faster - returns plain objects instead of Mongoose documents
    
    if (allJobs.length === 0) {
      return [];
    }
    
    console.log(`📊 Fetched ${allJobs.length} jobs from database`);

    // Use AI-powered matching service
    // This will analyze each job using Gemini API for intelligent matching
    try {
      const recommendations = await aiJobMatchingService.analyzeMultipleJobs(user, allJobs);
      
      // Ensure all recommendations have matchPercentage
      return recommendations.map(rec => {
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
        return rec;
      });
    } catch (aiError) {
      console.error('AI matching failed, falling back to rule-based:', aiError.message);
      // Fallback to rule-based matching if AI fails
      return getJobRecommendationsFallback(user, allJobs);
    }
  } catch (error) {
    console.error('Error in getJobRecommendations:', error);
    // Return empty array instead of throwing - graceful degradation
    return [];
  }
};

/**
 * Fallback rule-based job matching (used when AI fails)
 * @param {Object} user - User object
 * @param {Array} allJobs - Array of all jobs
 * @returns {Array} Array of recommended jobs
 */
const getJobRecommendationsFallback = async (user, allJobs) => {
  try {
    // Initialize ChromaDB for semantic matching (graceful degradation if fails)
    let chromaAvailable = false;
    try {
      await chromaService.initialize();
      chromaAvailable = chromaService.initialized;
    } catch (error) {
      chromaAvailable = false;
    }

    const recommendations = await Promise.all(
      allJobs.map(async (job) => {
        try {
          // Exact skill matching (case-insensitive)
          const exactMatchedSkills = user.skills.filter((userSkill) =>
            job.requiredSkills.some(
              (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
            )
          );

          // Semantic skill matching using ChromaDB embeddings
          let semanticMatchedSkills = [];
          if (chromaAvailable) {
            try {
              for (const jobSkill of job.requiredSkills) {
                if (exactMatchedSkills.some(s => s.toLowerCase() === jobSkill.toLowerCase())) {
                  continue;
                }
                
                const similarSkills = await chromaService.searchSimilarSkills(jobSkill, 5);
                
                const userHasSimilar = user.skills.some(userSkill => {
                  const normalizedUserSkill = userSkill.toLowerCase();
                  return similarSkills.some(sim => {
                    const normalizedSimSkill = sim.skill.toLowerCase();
                    return normalizedSimSkill === normalizedUserSkill ||
                           (sim.distance < 0.3 && normalizedSimSkill.includes(normalizedUserSkill)) ||
                           (sim.distance < 0.3 && normalizedUserSkill.includes(normalizedSimSkill));
                  });
                });
                
                if (userHasSimilar) {
                  semanticMatchedSkills.push(jobSkill);
                }
              }
            } catch (error) {
              // Silently continue with exact matching only
            }
          }

          const allMatchedSkills = [...new Set([...exactMatchedSkills, ...semanticMatchedSkills])];
          const missingSkills = job.requiredSkills.filter(
            (jobSkill) =>
              !allMatchedSkills.some(
                (matchedSkill) => matchedSkill.toLowerCase() === jobSkill.toLowerCase()
              )
          );

          if (allMatchedSkills.length > 0) {
            const baseScore = allMatchedSkills.length / (job.requiredSkills.length || 1);
            let matchScore = baseScore;
            
            let trackMatch = false;
            if (user.preferredTrack && job.track && 
                user.preferredTrack.toLowerCase() === job.track.toLowerCase()) {
              matchScore += 0.2;
              trackMatch = true;
            }
            
            let experienceMatch = false;
            const experienceLevels = { 'Fresher': 1, 'Junior': 2, 'Mid': 3, 'Senior': 4 };
            const userExpLevel = experienceLevels[user.experienceLevel] || 1;
            const jobExpLevel = experienceLevels[job.experienceLevel] || 1;
            
            if (userExpLevel >= jobExpLevel) {
              matchScore += 0.1;
              experienceMatch = true;
            } else if (userExpLevel === jobExpLevel - 1) {
              matchScore += 0.05;
            }
            
            matchScore = Math.min(matchScore, 1.0);
            const matchPercentage = Math.round(matchScore * 100);
            
            const keyReasons = generateKeyReasons(
              allMatchedSkills,
              missingSkills,
              trackMatch,
              experienceMatch,
              user.experienceLevel,
              job.experienceLevel
            );
            
            const applicationPlatforms = getApplicationPlatforms(job.track, job.jobType);

            return {
              jobId: job._id,
              job: job,
              matchedSkills: allMatchedSkills,
              missingSkills,
              matchScore,
              matchPercentage,
              keyReasons,
              applicationPlatforms,
              semanticMatches: semanticMatchedSkills.length > 0,
              aiEnhanced: false,
            };
          }

          return null;
        } catch (error) {
          console.error(`Error processing job ${job._id}:`, error.message);
          return null;
        }
      })
    );

    return recommendations
      .filter((rec) => rec !== null)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  } catch (error) {
    console.error('Error in fallback job recommendations:', error);
    return [];
  }
};

/**
 * Get learning resource recommendations based on user skills and interests
 * Uses AI-powered resource recommendation agent for intelligent matching
 * @param {string} userId - User's MongoDB _id
 * @returns {Array} Array of recommended resources
 */
const getResourceRecommendations = async (userId) => {
  try {
    // Use AI-powered resource recommendation agent
    const recommendations = await resourceRecommendationAgent.getResourceRecommendations(userId);
    
    // Ensure all recommendations have matchPercentage
    return recommendations.map(rec => {
      if (rec.matchPercentage === undefined || rec.matchPercentage === null) {
        if (rec.matchScore !== undefined) {
          rec.matchPercentage = Math.round(rec.matchScore * 100);
        } else if (rec.matchedItems && rec.resource?.relatedSkills) {
          const baseScore = rec.matchedItems.length / rec.resource.relatedSkills.length;
          rec.matchPercentage = Math.round(baseScore * 100);
        } else {
          rec.matchPercentage = 0;
        }
      }
      return rec;
    });
  } catch (error) {
    console.error('AI resource recommendations failed, using fallback:', error);
    // Fallback to simple matching
    return await resourceRecommendationAgent.getFallbackRecommendations(userId);
  }
};

/**
 * Get local job recommendations from bdjobs.com
 * Uses localJobRecommendationAgent to filter and match bdjobs.com jobs
 * @param {string} userId - User's MongoDB _id
 * @param {Object} user - User object (optional, for optimization)
 * @returns {Array} Array of recommended local jobs
 */
const getLocalJobRecommendations = async (userId, user = null) => {
  try {
    // Use local job recommendation agent
    const recommendations = await localJobRecommendationAgent.getLocalJobRecommendations(userId);
    
    // Ensure all recommendations have matchPercentage
    return recommendations.map(rec => {
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
      return rec;
    });
  } catch (error) {
    console.error('Error in getLocalJobRecommendations:', error);
    // Return empty array instead of throwing - graceful degradation
    return [];
  }
};

module.exports = {
  getJobRecommendations,
  getResourceRecommendations,
  getLocalJobRecommendations,
};

