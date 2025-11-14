const aiService = require('./aiService');
const jobMatchPercentageAgent = require('../agents/jobMatchPercentageAgent');

/**
 * AI-Powered Job Matching Service
 * Orchestrates the job matching process using the AI Agent
 * Separated from AI Agent for better maintainability
 */
class AIJobMatchingService {

  /**
   * Analyze job match using AI Agent
   * Orchestrates the matching process: embedding, similarity calculation, and result generation
   * 
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @param {Object} options - Options: { skipEmbedding: boolean, skipAIReasons: boolean }
   * @returns {Object} Match analysis with percentage, reasons, and platforms
   */
  async analyzeJobMatch(user, job, options = {}) {
    const { skipEmbedding = false, skipAIReasons = false } = options;
    
    try {
      console.log(`\n🤖 Job Match Percentage Agent: Starting match analysis`);
      console.log(`   Job: ${job.title} at ${job.company}`);
      console.log(`   User: ${user.fullName || user.email || user._id}\n`);

      // Skip embedding if already done (to avoid duplicates and save time)
      if (!skipEmbedding) {
        // Step 1: Embed job details (MUST be done first)
        console.log(`📌 Step 1: Embedding job details...`);
        const jobEmbedded = await jobMatchPercentageAgent.embedJob(job);
        if (!jobEmbedded) {
          console.warn('⚠️  Job embedding failed, using fallback matching');
        }

        // Step 2: Embed user profile (MUST be done second)
        console.log(`📌 Step 2: Embedding user profile...`);
        const userEmbedded = await jobMatchPercentageAgent.embedUser(user);
        if (!userEmbedded) {
          console.warn('⚠️  User embedding failed, using fallback matching');
        }

        // Wait for embeddings to be processed by ChromaDB
        console.log(`⏳ Waiting for embeddings to be processed...`);
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log(`⏭️  Skipping embedding (already done)`);
        // Still wait a bit for embeddings to be ready
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Step 3: Calculate similarity using embeddings (MUST be done after embedding)
      console.log(`📌 Step 3: Calculating similarity using embeddings...`);
      let similarityScore = await jobMatchPercentageAgent.calculateSimilarity(user, job);
      
      if (similarityScore > 0) {
        console.log(`✅ Embedding-based similarity: ${Math.round(similarityScore * 100)}%`);
      } else {
        console.warn('⚠️  No embedding similarity found, using fallback calculation');
      }

      // Step 4: Extract matched and missing skills using Job Match Percentage Agent
      let { matchedSkills, missingSkills } = jobMatchPercentageAgent.extractSkills(user, job);

      // Fallback: Calculate exact skill matches if similarity is 0
      if (similarityScore === 0) {
        // Calculate base similarity from skill overlap
        if (job.requiredSkills && job.requiredSkills.length > 0) {
          similarityScore = matchedSkills.length / job.requiredSkills.length;
        }
      }

      // Only return if there's at least one match
      if (matchedSkills.length === 0 && similarityScore < 0.1) {
        return null;
      }

      // Step 5: Calculate match percentage using Job Match Percentage Agent (MUST be done after embedding)
      console.log(`📌 Step 5: Calculating match percentage from embeddings...`);
      const matchPercentage = jobMatchPercentageAgent.calculateMatchPercentage(similarityScore, user, job);
      const trackMatch = jobMatchPercentageAgent.isTrackMatch(user, job);
      const experienceMatch = jobMatchPercentageAgent.isExperienceMatch(user, job);
      
      // Calculate matchScore (0-1) from matchPercentage for consistency
      const matchScore = matchPercentage / 100;
      
      console.log(`\n✅ Final Match Result:`);
      console.log(`   Match Percentage: ${matchPercentage}%`);
      console.log(`   Match Score: ${matchScore.toFixed(2)}`);
      console.log(`   Embedding Similarity: ${Math.round(similarityScore * 100)}%`);
      console.log(`   Track Match: ${trackMatch ? 'Yes' : 'No'}`);
      console.log(`   Experience Match: ${experienceMatch ? 'Yes' : 'No'}\n`);
      
      // Generate key reasons - use fallback for faster response if skipAIReasons is true
      const keyReasons = skipAIReasons
        ? this.generateFallbackReasons(matchedSkills, missingSkills, trackMatch, experienceMatch, user.experienceLevel, job.experienceLevel)
        : await this.generateKeyReasons(
            matchedSkills,
            missingSkills,
            trackMatch,
            experienceMatch,
            user.experienceLevel,
            job.experienceLevel,
            matchPercentage
          );
      
      // Get application platforms
      const applicationPlatforms = this.getApplicationPlatforms(job.track, job.jobType);

      return {
        jobId: job._id,
        job: job,
        matchedSkills,
        missingSkills,
        matchScore, // Now properly defined!
        matchPercentage,
        keyReasons,
        applicationPlatforms,
        embeddingBased: similarityScore > 0,
        aiAgent: true, // Flag indicating this was generated by Job Match Percentage Agent
        embeddingSimilarity: Math.round(similarityScore * 100), // Raw embedding similarity percentage
      };
    } catch (error) {
      console.error('Error in AI job match analysis:', error);
      // Fallback to rule-based matching if embedding fails
      return this.fallbackMatchAnalysis(user, job);
    }
  }

  /**
   * Generate key reasons using AI
   */
  async generateKeyReasons(matchedSkills, missingSkills, trackMatch, experienceMatch, userExp, jobExp, matchPercentage) {
    try {
      const prompt = `Generate 2-4 concise key reasons for a job match with ${matchPercentage}% match score.

Matched Skills: ${matchedSkills.join(', ') || 'None'}
Missing Skills: ${missingSkills.join(', ') || 'None'}
Track Match: ${trackMatch ? 'Yes' : 'No'}
Experience Match: ${experienceMatch ? 'Yes' : 'No'}
User Experience: ${userExp}
Job Requires: ${jobExp}

Generate reasons in this format:
- "Matches React, JS, HTML; missing Redux and TypeScript"
- "Perfect alignment with your preferred career track"
- "Your Mid experience level meets the Mid requirement"

Return a JSON object with this structure:
{
  "keyReasons": ["reason1", "reason2", "reason3"]
}

Return ONLY valid JSON, no markdown, no code blocks.`;

      const response = await aiService.generateStructuredJSON(prompt, {
        keyReasons: 'array',
      });

      if (response.keyReasons && Array.isArray(response.keyReasons)) {
        return response.keyReasons;
      }
    } catch (error) {
      console.error('AI key reasons generation failed:', error.message);
    }

    // Fallback to rule-based reasons
    return this.generateFallbackReasons(matchedSkills, missingSkills, trackMatch, experienceMatch, userExp, jobExp);
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
   * Fallback rule-based matching if embeddings fail
   */
  fallbackMatchAnalysis(user, job) {
    const exactMatchedSkills = (user.skills || []).filter((userSkill) =>
      (job.requiredSkills || []).some(
        (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
      )
    );

    if (exactMatchedSkills.length === 0) {
      return null;
    }

    const missingSkills = (job.requiredSkills || []).filter(
      (jobSkill) =>
        !exactMatchedSkills.some(
          (matchedSkill) => matchedSkill.toLowerCase() === jobSkill.toLowerCase()
        )
    );

    const baseScore = exactMatchedSkills.length / ((job.requiredSkills?.length || 1));
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
      embeddingBased: false,
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
   * AI Agent: Analyze multiple jobs - OPTIMIZED FOR SPEED
   * Uses fast rule-based matching with early filtering to process jobs quickly
   * Skips expensive ChromaDB/embeddings for most jobs
   * 
   * @param {Object} user - User profile
   * @param {Array} jobs - Array of job objects
   * @returns {Array} Array of match analyses
   */
  async analyzeMultipleJobs(user, jobs) {
    try {
      const startTime = Date.now();
      console.log(`⚡ OPTIMIZED: Analyzing ${jobs.length} jobs with fast rule-based matching...`);

      // OPTIMIZATION 1: Early filtering - remove jobs with 0 matches BEFORE processing
      // This eliminates expensive operations on irrelevant jobs
      const preFilteredJobs = jobs
        .map(job => {
          // Quick skill check (no ChromaDB, no AI)
          const exactMatchedSkills = (user.skills || []).filter((userSkill) =>
            (job.requiredSkills || []).some(
              (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
            )
          );
          return { job, matchedSkills: exactMatchedSkills };
        })
        .filter(({ matchedSkills }) => matchedSkills.length > 0) // Only jobs with matches
        .sort((a, b) => b.matchedSkills.length - a.matchedSkills.length) // Sort by match count
        .slice(0, 20); // LIMIT to top 20 matches only (prevents processing too many)
      
      if (preFilteredJobs.length === 0) {
        console.log(`✅ No matching jobs found (processed in ${Date.now() - startTime}ms)`);
        return [];
      }

      const filteredJobs = preFilteredJobs.map(({ job }) => job);
      console.log(`✅ Pre-filtered to ${filteredJobs.length} relevant jobs (from ${jobs.length} total)`);

      // OPTIMIZATION 2: Skip ChromaDB/embeddings entirely for speed
      // Use fast rule-based matching for all jobs (no AI calls, no ChromaDB queries)
      console.log(`⚡ Using fast rule-based matching (no embeddings, no AI delays)...`);
      
      // OPTIMIZATION 3: Process in parallel with Promise.all (much faster than sequential)
      const results = await Promise.all(
        filteredJobs.map(async (job) => {
          try {
            // Use fallback analysis (fast, no AI/ChromaDB, no delays)
            return this.fallbackMatchAnalysis(user, job);
          } catch (error) {
            console.warn(`Error processing job ${job._id}:`, error.message);
            return null;
          }
        })
      );

      // Filter nulls, sort by match score, and limit to top 10
      const validResults = results
        .filter(rec => rec !== null)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 10); // Return top 10 only

      const duration = Date.now() - startTime;
      console.log(`✅ Processed ${validResults.length} job recommendations in ${duration}ms (${filteredJobs.length} jobs analyzed)`);
      
      return validResults;

    } catch (error) {
      console.error('Error analyzing multiple jobs:', error);
      // Fallback: quick rule-based matching
      return jobs
        .map(job => this.fallbackMatchAnalysis(user, job))
        .filter(rec => rec !== null)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 10);
    }
  }
}

module.exports = new AIJobMatchingService();
