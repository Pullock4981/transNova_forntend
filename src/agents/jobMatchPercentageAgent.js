const chromaService = require('../services/chromaService');

/**
 * Job Match Percentage Agent
 * 
 * Purpose: Calculates intelligent match percentage between user profiles and job postings
 * 
 * Responsibilities:
 * - Embeds user profiles and job details into ChromaDB vector database
 * - Calculates semantic similarity using embeddings
 * - Computes match percentage (0-100%) based on three factors:
 *   1. Skill Overlap (60% weight): Exact matches between user skills and job requirements
 *   2. Experience Level Alignment (20% weight): How well user experience matches job requirements
 *   3. Track/Interest Alignment (20% weight): Alignment between user's preferred track and job track
 * - Extracts matched and missing skills for transparency
 * - Provides detailed match breakdown for explainability
 * 
 * Match Calculation Formula:
 *   - If embeddings available: (blended_skill_score * 0.6) + (experience_score * 0.2) + (track_score * 0.2)
 *   - Blended skill score: (embedding_similarity * 0.4) + (exact_skill_overlap * 0.6)
 *   - If no embeddings: (exact_skill_overlap * 0.6) + (experience_score * 0.2) + (track_score * 0.2)
 * 
 * Usage:
 *   const agent = require('./agents/jobMatchPercentageAgent');
 *   await agent.initialize();
 *   await agent.embedJob(job);
 *   await agent.embedUser(user);
 *   const similarity = await agent.calculateSimilarity(user, job);
 *   const percentage = agent.calculateMatchPercentage(similarity, user, job);
 *   const breakdown = agent.getMatchBreakdown(similarity, user, job);
 */
class JobMatchPercentageAgent {
  /**
   * Initialize the agent and ChromaDB connection
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
  }

  /**
   * Create a text representation of job for embedding
   * @param {Object} job - Job object
   * @returns {String} Text representation
   */
  createJobText(job) {
    const parts = [
      `Job Title: ${job.title}`,
      `Company: ${job.company}`,
      `Required Skills: ${(job.requiredSkills || []).join(', ')}`,
      `Experience Level: ${job.experienceLevel}`,
      `Career Track: ${job.track}`,
      `Job Type: ${job.jobType}`,
      `Location: ${job.location}`,
    ];
    return parts.join('. ');
  }

  /**
   * Create a text representation of user profile for embedding
   * @param {Object} user - User object
   * @returns {String} Text representation
   */
  createUserText(user) {
    const parts = [
      `Skills: ${(user.skills || []).join(', ')}`,
      `Experience Level: ${user.experienceLevel || 'Fresher'}`,
      `Preferred Career Track: ${user.preferredTrack || ''}`,
      `Career Interests: ${(user.careerInterests || []).join(', ')}`,
      `Education Level: ${user.educationLevel || ''}`,
    ];
    return parts.join('. ');
  }

  /**
   * Embed job details into ChromaDB vector database
   * MUST be called before calculating match percentage
   * 
   * @param {Object} job - Job object
   * @returns {Boolean} True if embedding was successful
   */
  async embedJob(job) {
    try {
      await this.initialize();
      if (!chromaService.collection) {
        console.warn('⚠️  ChromaDB not available, cannot embed job');
        return false;
      }

      const jobText = this.createJobText(job);
      
      // Add job to ChromaDB with embedding (ChromaDB automatically creates embeddings)
      await chromaService.collection.add({
        ids: [`job_${job._id}`],
        documents: [jobText],
        metadatas: [{
          type: 'job',
          jobId: job._id.toString(),
          title: job.title,
          company: job.company,
          track: job.track,
          experienceLevel: job.experienceLevel,
          jobType: job.jobType,
          location: job.location,
          requiredSkills: (job.requiredSkills || []).join(','),
        }],
      });
      
      console.log(`✅ Job embedded: ${job.title} (ID: ${job._id})`);
      return true;
    } catch (error) {
      console.error(`❌ Error embedding job ${job._id}:`, error.message);
      return false;
    }
  }

  /**
   * Embed user profile into ChromaDB vector database
   * MUST be called before calculating match percentage
   * 
   * @param {Object} user - User object
   * @returns {Boolean} True if embedding was successful
   */
  async embedUser(user) {
    try {
      await this.initialize();
      if (!chromaService.collection) {
        console.warn('⚠️  ChromaDB not available, cannot embed user');
        return false;
      }

      const userText = this.createUserText(user);
      
      // Add user profile to ChromaDB with embedding (ChromaDB automatically creates embeddings)
      await chromaService.collection.add({
        ids: [`user_${user._id}`],
        documents: [userText],
        metadatas: [{
          type: 'user',
          userId: user._id.toString(),
          experienceLevel: user.experienceLevel || 'Fresher',
          preferredTrack: user.preferredTrack || '',
          skills: (user.skills || []).join(','),
          careerInterests: (user.careerInterests || []).join(','),
          educationLevel: user.educationLevel || '',
        }],
      });
      
      console.log(`✅ User embedded: ${user.fullName || user.email || user._id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error embedding user ${user._id}:`, error.message);
      return false;
    }
  }

  /**
   * Calculate similarity between user and job using embeddings
   * REQUIRES: Both job and user must be embedded first using embedJob() and embedUser()
   * Uses bidirectional matching for better accuracy
   * 
   * @param {Object} user - User profile (must be embedded first)
   * @param {Object} job - Job details (must be embedded first)
   * @returns {Number} Similarity score (0-1)
   */
  async calculateSimilarity(user, job) {
    try {
      await this.initialize();
      if (!chromaService.collection) {
        console.warn('⚠️  ChromaDB not available, cannot calculate similarity');
        return 0;
      }

      // Create text representations for querying
      // Note: These will be embedded by ChromaDB and compared against stored embeddings
      const jobText = this.createJobText(job);
      const userText = this.createUserText(user);
      
      console.log(`🔍 Calculating similarity using embeddings for job: ${job.title}`);

      let similarityScore = 0;

      // Method 1: Query jobs using user profile as query
      const userToJobResults = await chromaService.collection.query({
        queryTexts: [userText],
        nResults: 50,
        where: { type: 'job' },
      });

      // Find this specific job in results
      if (userToJobResults.ids && userToJobResults.ids[0]) {
        const jobIndex = userToJobResults.ids[0].findIndex(id => id === `job_${job._id}`);
        if (jobIndex !== -1) {
          const distance = userToJobResults.distances?.[0]?.[jobIndex];
          if (distance !== undefined) {
            // Convert distance to similarity (0-1 scale)
            similarityScore = Math.max(0, Math.min(1, 1 - distance));
          }
        }
      }

      // Method 2: Query user profiles using job as query (bidirectional matching)
      const jobToUserResults = await chromaService.collection.query({
        queryTexts: [jobText],
        nResults: 50,
        where: { type: 'user' },
      });

      // If we found the user in results, average the two similarity scores
      if (jobToUserResults.ids && jobToUserResults.ids[0]) {
        const userIndex = jobToUserResults.ids[0].findIndex(id => id === `user_${user._id}`);
        if (userIndex !== -1) {
          const reverseDistance = jobToUserResults.distances?.[0]?.[userIndex];
          if (reverseDistance !== undefined) {
            const reverseSimilarity = Math.max(0, Math.min(1, 1 - reverseDistance));
            // Average both directions for more accurate matching
            similarityScore = (similarityScore + reverseSimilarity) / 2;
          }
        }
      }

      return similarityScore;
    } catch (error) {
      console.error('Job Match Percentage Agent - similarity calculation error:', error.message);
      return 0;
    }
  }

  /**
   * Extract matched and missing skills using exact matching
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Object} { matchedSkills, missingSkills }
   */
  extractSkills(user, job) {
    const userSkills = user.skills || [];
    const jobSkills = job.requiredSkills || [];

    const matchedSkills = userSkills.filter((userSkill) =>
      jobSkills.some(
        (jobSkill) => userSkill.toLowerCase() === jobSkill.toLowerCase()
      )
    );

    const missingSkills = jobSkills.filter(
      (jobSkill) =>
        !matchedSkills.some(
          (matchedSkill) => matchedSkill.toLowerCase() === jobSkill.toLowerCase()
        )
    );

    return { matchedSkills, missingSkills };
  }

  /**
   * Calculate match percentage based on three factors:
   * 1. Skill overlap (exact matches between user skills and job requirements)
   * 2. Experience level alignment
   * 3. Preferred track/interest alignment
   * 
   * Combines embedding-based similarity with exact skill matching for accuracy
   * 
   * @param {Number} similarityScore - Base similarity from embeddings (0-1)
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Number} Match percentage (0-100)
   */
  calculateMatchPercentage(similarityScore, user, job) {
    // Factor 1: Skill Overlap (weight: 60%)
    // Calculate exact skill matches
    const { matchedSkills } = this.extractSkills(user, job);
    const skillOverlapScore = job.requiredSkills && job.requiredSkills.length > 0
      ? matchedSkills.length / job.requiredSkills.length
      : 0;
    
    // Factor 2: Experience Level Alignment (weight: 20%)
    const experienceLevels = { 'Fresher': 1, 'Junior': 2, 'Mid': 3, 'Senior': 4 };
    const userExpLevel = experienceLevels[user.experienceLevel] || 1;
    const jobExpLevel = experienceLevels[job.experienceLevel] || 1;
    
    let experienceScore = 0;
    if (userExpLevel >= jobExpLevel) {
      experienceScore = 1.0; // Perfect match
    } else if (userExpLevel === jobExpLevel - 1) {
      experienceScore = 0.7; // One level below (still acceptable)
    } else if (userExpLevel === jobExpLevel - 2) {
      experienceScore = 0.4; // Two levels below (marginal)
    } else {
      experienceScore = 0.1; // Too far below
    }
    
    // Factor 3: Track/Interest Alignment (weight: 20%)
    const trackMatch = this.isTrackMatch(user, job);
    const trackScore = trackMatch ? 1.0 : 0.0;
    
    // Combine factors with weights
    // If embedding similarity is available, blend it with exact skill matching
    let finalScore;
    if (similarityScore > 0) {
      // Blend embedding similarity (40%) with exact skill overlap (60%)
      const blendedSkillScore = (similarityScore * 0.4) + (skillOverlapScore * 0.6);
      // Combine all three factors
      finalScore = (blendedSkillScore * 0.6) + (experienceScore * 0.2) + (trackScore * 0.2);
    } else {
      // No embedding similarity, use exact skill matching only
      finalScore = (skillOverlapScore * 0.6) + (experienceScore * 0.2) + (trackScore * 0.2);
    }
    
    // Cap match score at 1.0
    finalScore = Math.min(finalScore, 1.0);
    
    // Convert to percentage and round
    return Math.round(finalScore * 100);
  }

  /**
   * Check if track matches
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Boolean}
   */
  isTrackMatch(user, job) {
    return user.preferredTrack && job.track && 
           user.preferredTrack.toLowerCase() === job.track.toLowerCase();
  }

  /**
   * Check if experience level matches
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Boolean}
   */
  isExperienceMatch(user, job) {
    const experienceLevels = { 'Fresher': 1, 'Junior': 2, 'Mid': 3, 'Senior': 4 };
    const userExpLevel = experienceLevels[user.experienceLevel] || 1;
    const jobExpLevel = experienceLevels[job.experienceLevel] || 1;
    return userExpLevel >= jobExpLevel;
  }

  /**
   * Get detailed breakdown of match calculation
   * Provides transparency into how the match percentage was calculated
   * 
   * @param {Number} similarityScore - Embedding similarity (0-1)
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Object} Match breakdown with all factors
   */
  getMatchBreakdown(similarityScore, user, job) {
    const { matchedSkills, missingSkills } = this.extractSkills(user, job);
    
    // Factor 1: Skill Overlap
    const skillOverlapScore = job.requiredSkills && job.requiredSkills.length > 0
      ? matchedSkills.length / job.requiredSkills.length
      : 0;
    
    // Factor 2: Experience Level Alignment
    const experienceLevels = { 'Fresher': 1, 'Junior': 2, 'Mid': 3, 'Senior': 4 };
    const userExpLevel = experienceLevels[user.experienceLevel] || 1;
    const jobExpLevel = experienceLevels[job.experienceLevel] || 1;
    
    let experienceScore = 0;
    let experienceStatus = 'mismatch';
    if (userExpLevel >= jobExpLevel) {
      experienceScore = 1.0;
      experienceStatus = 'meets_requirement';
    } else if (userExpLevel === jobExpLevel - 1) {
      experienceScore = 0.7;
      experienceStatus = 'one_level_below';
    } else if (userExpLevel === jobExpLevel - 2) {
      experienceScore = 0.4;
      experienceStatus = 'two_levels_below';
    } else {
      experienceScore = 0.1;
      experienceStatus = 'too_far_below';
    }
    
    // Factor 3: Track/Interest Alignment
    const trackMatch = this.isTrackMatch(user, job);
    const trackScore = trackMatch ? 1.0 : 0.0;
    
    // Calculate final score
    let blendedSkillScore;
    if (similarityScore > 0) {
      blendedSkillScore = (similarityScore * 0.4) + (skillOverlapScore * 0.6);
    } else {
      blendedSkillScore = skillOverlapScore;
    }
    
    const finalScore = (blendedSkillScore * 0.6) + (experienceScore * 0.2) + (trackScore * 0.2);
    const matchPercentage = Math.round(Math.min(finalScore, 1.0) * 100);
    
    return {
      matchPercentage,
      factors: {
        skillOverlap: {
          score: skillOverlapScore,
          weight: 0.6,
          contribution: Math.round(blendedSkillScore * 0.6 * 100),
          matchedSkills: matchedSkills.length,
          totalRequiredSkills: job.requiredSkills?.length || 0,
          matchedSkillsList: matchedSkills,
          missingSkillsList: missingSkills,
        },
        experienceAlignment: {
          score: experienceScore,
          weight: 0.2,
          contribution: Math.round(experienceScore * 0.2 * 100),
          userLevel: user.experienceLevel,
          jobLevel: job.experienceLevel,
          status: experienceStatus,
        },
        trackAlignment: {
          score: trackScore,
          weight: 0.2,
          contribution: Math.round(trackScore * 0.2 * 100),
          userTrack: user.preferredTrack,
          jobTrack: job.track,
          matched: trackMatch,
        },
      },
      embeddingSimilarity: similarityScore > 0 ? Math.round(similarityScore * 100) : null,
    };
  }
}

module.exports = new JobMatchPercentageAgent();

