const aiService = require('./aiService');
const chromaService = require('./chromaService');

/**
 * AI-Powered Job Matching Service
 * Uses Gemini API to intelligently analyze job matches and generate:
 * - Match percentage
 * - Key reasons for match/mismatch
 * - Application platform recommendations
 */
class AIJobMatchingService {
  /**
   * Analyze a single job match using AI
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Object} Match analysis with percentage, reasons, and platforms
   */
  async analyzeJobMatch(user, job) {
    try {
      // First, do exact skill matching
      const exactMatchedSkills = user.skills.filter((userSkill) =>
        job.requiredSkills.some(
          (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
        )
      );

      // Find missing skills
      const missingSkills = job.requiredSkills.filter(
        (jobSkill) =>
          !exactMatchedSkills.some(
            (matchedSkill) => matchedSkill.toLowerCase() === jobSkill.toLowerCase()
          )
      );

      // Only analyze if there's at least one match
      if (exactMatchedSkills.length === 0) {
        return null;
      }

      // Prepare context for AI analysis
      const userContext = {
        skills: user.skills || [],
        experienceLevel: user.experienceLevel || 'Fresher',
        preferredTrack: user.preferredTrack || '',
        careerInterests: user.careerInterests || [],
        educationLevel: user.educationLevel || '',
      };

      const jobContext = {
        title: job.title,
        company: job.company,
        requiredSkills: job.requiredSkills || [],
        experienceLevel: job.experienceLevel,
        track: job.track,
        jobType: job.jobType,
        location: job.location,
      };

      // Use AI to analyze the match
      const aiAnalysis = await this.getAIMatchAnalysis(
        userContext,
        jobContext,
        exactMatchedSkills,
        missingSkills
      );

      // Calculate base match score from skills
      const baseScore = exactMatchedSkills.length / (job.requiredSkills.length || 1);
      
      // Apply AI-calculated adjustments
      let matchScore = baseScore;
      
      // Track alignment boost
      let trackMatch = false;
      if (user.preferredTrack && job.track && 
          user.preferredTrack.toLowerCase() === job.track.toLowerCase()) {
        matchScore += 0.2;
        trackMatch = true;
      }
      
      // Experience level alignment
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
      
      // Apply AI-suggested adjustments if available
      if (aiAnalysis && aiAnalysis.scoreAdjustment) {
        matchScore += aiAnalysis.scoreAdjustment;
      }
      
      // Cap at 1.0
      matchScore = Math.min(matchScore, 1.0);
      
      // Calculate match percentage
      const matchPercentage = Math.round(matchScore * 100);
      
      // Generate key reasons (use AI-generated if available, otherwise fallback)
      const keyReasons = aiAnalysis?.keyReasons || this.generateFallbackReasons(
        exactMatchedSkills,
        missingSkills,
        trackMatch,
        experienceMatch,
        user.experienceLevel,
        job.experienceLevel
      );
      
      // Get application platforms
      const applicationPlatforms = this.getApplicationPlatforms(job.track, job.jobType);

      return {
        jobId: job._id,
        job: job,
        matchedSkills: exactMatchedSkills,
        missingSkills,
        matchScore,
        matchPercentage,
        keyReasons,
        applicationPlatforms,
        aiEnhanced: !!aiAnalysis,
      };
    } catch (error) {
      console.error('Error in AI job match analysis:', error);
      // Fallback to rule-based matching if AI fails
      return this.fallbackMatchAnalysis(user, job);
    }
  }

  /**
   * Get AI-powered match analysis using Gemini
   * @param {Object} userContext - User profile context
   * @param {Object} jobContext - Job context
   * @param {Array} matchedSkills - Skills that match
   * @param {Array} missingSkills - Skills that are missing
   * @returns {Object} AI analysis with score adjustment and key reasons
   */
  async getAIMatchAnalysis(userContext, jobContext, matchedSkills, missingSkills) {
    try {
      const prompt = `You are an intelligent career matching AI. Analyze the match between a candidate and a job posting.

CANDIDATE PROFILE:
- Skills: ${userContext.skills.join(', ')}
- Experience Level: ${userContext.experienceLevel}
- Preferred Career Track: ${userContext.preferredTrack}
- Career Interests: ${userContext.careerInterests.join(', ')}
- Education Level: ${userContext.educationLevel}

JOB POSTING:
- Title: ${jobContext.title}
- Company: ${jobContext.company}
- Required Skills: ${jobContext.requiredSkills.join(', ')}
- Experience Level Required: ${jobContext.experienceLevel}
- Career Track: ${jobContext.track}
- Job Type: ${jobContext.jobType}
- Location: ${jobContext.location}

MATCH ANALYSIS:
- Matched Skills: ${matchedSkills.join(', ')}
- Missing Skills: ${missingSkills.join(', ')}

Your task:
1. Calculate a match score adjustment (between -0.2 and +0.2) based on:
   - Quality of skill matches (not just quantity)
   - Transferable skills that could compensate for missing ones
   - Career track alignment
   - Experience level fit
   - Overall candidate-job compatibility

2. Generate 2-4 key reasons explaining why this is a good match (or why it's not ideal), in a concise format like:
   - "Matches React, JS, HTML; missing Redux and TypeScript"
   - "Perfect alignment with your preferred career track"
   - "Your Mid experience level meets the Mid requirement"
   - "Strong foundational skills, but missing some advanced requirements"

3. Consider transferable skills (e.g., if user knows JavaScript and job requires TypeScript, that's a partial match)

Return a JSON object with this structure:
{
  "scoreAdjustment": <number between -0.2 and 0.2>,
  "keyReasons": [<array of 2-4 concise reason strings>],
  "matchQuality": "<excellent|good|fair|poor>",
  "recommendation": "<brief recommendation text>"
}

Return ONLY valid JSON, no markdown, no code blocks.`;

      const analysis = await aiService.generateStructuredJSON(prompt, {
        scoreAdjustment: 'number',
        keyReasons: 'array',
        matchQuality: 'string',
        recommendation: 'string',
      });

      return {
        scoreAdjustment: Math.max(-0.2, Math.min(0.2, analysis.scoreAdjustment || 0)),
        keyReasons: analysis.keyReasons || [],
        matchQuality: analysis.matchQuality || 'fair',
        recommendation: analysis.recommendation || '',
      };
    } catch (error) {
      console.error('AI match analysis failed, using fallback:', error.message);
      return null;
    }
  }

  /**
   * Generate fallback reasons if AI fails
   */
  generateFallbackReasons(matchedSkills, missingSkills, trackMatch, experienceMatch, userExp, jobExp) {
    const reasons = [];
    
    if (matchedSkills.length > 0 || missingSkills.length > 0) {
      let primaryReason = '';
      
      if (matchedSkills.length > 0) {
        const topMatchedSkills = matchedSkills.slice(0, 5).join(', ');
        primaryReason = `Matches ${topMatchedSkills}`;
      }
      
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
    
    if (trackMatch) {
      reasons.push('Perfect alignment with your preferred career track');
    }
    
    if (experienceMatch) {
      reasons.push(`Your ${userExp} experience level meets the ${jobExp} requirement`);
    } else if (userExp && jobExp && userExp !== jobExp) {
      reasons.push(`Experience level: ${userExp} (job requires ${jobExp})`);
    }
    
    return reasons;
  }

  /**
   * Fallback rule-based matching if AI fails
   */
  fallbackMatchAnalysis(user, job) {
    const exactMatchedSkills = user.skills.filter((userSkill) =>
      job.requiredSkills.some(
        (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
      )
    );

    if (exactMatchedSkills.length === 0) {
      return null;
    }

    const missingSkills = job.requiredSkills.filter(
      (jobSkill) =>
        !exactMatchedSkills.some(
          (matchedSkill) => matchedSkill.toLowerCase() === jobSkill.toLowerCase()
        )
    );

    const baseScore = exactMatchedSkills.length / (job.requiredSkills.length || 1);
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
    
    const keyReasons = this.generateFallbackReasons(
      exactMatchedSkills,
      missingSkills,
      trackMatch,
      experienceMatch,
      user.experienceLevel,
      job.experienceLevel
    );
    
    const applicationPlatforms = this.getApplicationPlatforms(job.track, job.jobType);

    return {
      jobId: job._id,
      job: job,
      matchedSkills: exactMatchedSkills,
      missingSkills,
      matchScore,
      matchPercentage,
      keyReasons,
      applicationPlatforms,
      aiEnhanced: false,
    };
  }

  /**
   * Get application platforms based on job track and type
   */
  getApplicationPlatforms(track, jobType) {
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
  }

  /**
   * Analyze multiple jobs in parallel (with rate limiting)
   * @param {Object} user - User profile
   * @param {Array} jobs - Array of job objects
   * @returns {Array} Array of match analyses
   */
  async analyzeMultipleJobs(user, jobs) {
    try {
      // Process jobs in batches to avoid rate limiting
      const batchSize = 5;
      const results = [];
      
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(job => this.analyzeJobMatch(user, job))
        );
        results.push(...batchResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < jobs.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return results
        .filter(rec => rec !== null)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } catch (error) {
      console.error('Error analyzing multiple jobs:', error);
      // Fallback to rule-based matching
      return jobs
        .map(job => this.fallbackMatchAnalysis(user, job))
        .filter(rec => rec !== null)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }
  }
}

module.exports = new AIJobMatchingService();

