const aiService = require('../services/aiService');
const chromaService = require('../services/chromaService');
const jobMatchPercentageAgent = require('./jobMatchPercentageAgent');
const User = require('../models/User');
const Job = require('../models/Job');

/**
 * Skill Recommendation Agent
 * 
 * Purpose: Analyzes users and recommends necessary skills based on current job market
 * 
 * Responsibilities:
 * - Embeds user profiles
 * - Gets all job embeddings
 * - Uses AI to determine which skills are necessary for each user based on their domain
 * - Provides personalized skill recommendations
 */
class SkillRecommendationAgent {
  /**
   * Initialize ChromaDB
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
  }

  /**
   * Embed user profile into ChromaDB
   * @param {Object} user - User object
   * @returns {Boolean} True if successful
   */
  async embedUser(user) {
    try {
      await this.initialize();
      if (!chromaService.collection) {
        console.warn('⚠️  ChromaDB not available, cannot embed user');
        return false;
      }

      const userText = jobMatchPercentageAgent.createUserText(user);
      
      // Add user to ChromaDB
      await chromaService.collection.add({
        ids: [`user_${user._id}`],
        documents: [userText],
        metadatas: [{
          type: 'user',
          userId: user._id.toString(),
          track: user.preferredTrack || '',
          experienceLevel: user.experienceLevel || 'Fresher',
        }],
      });

      return true;
    } catch (error) {
      console.warn('User embedding warning (non-critical):', error.message);
      return false;
    }
  }

  /**
   * Get all job embeddings from ChromaDB
   * @param {String} userTrack - User's preferred track to filter jobs
   * @param {Array} preFetchedJobs - Optional pre-fetched jobs array for optimization
   * @returns {Array} Array of job documents and metadata
   */
  async getAllJobEmbeddings(userTrack = null, preFetchedJobs = null) {
    try {
      await this.initialize();
      if (!chromaService.collection) {
        return [];
      }

      // Use pre-fetched jobs if provided, otherwise fetch from database
      let jobs;
      if (preFetchedJobs && Array.isArray(preFetchedJobs)) {
        jobs = preFetchedJobs;
      } else {
        const query = {};
        if (userTrack) {
          query.track = userTrack;
        }
        jobs = await Job.find(query)
          .select('title company requiredSkills experienceLevel track jobType location')
          .lean();
      }

      // Filter by track if specified and using pre-fetched jobs
      if (userTrack && preFetchedJobs) {
        jobs = jobs.filter(job => job.track === userTrack);
      }

      // Get embeddings for these jobs from ChromaDB
      const jobIds = jobs.map(job => `job_${job._id}`);
      const jobTexts = jobs.map(job => jobMatchPercentageAgent.createJobText(job));

      return {
        jobs,
        jobTexts,
        jobIds,
      };
    } catch (error) {
      console.error('Error getting job embeddings:', error);
      return { jobs: [], jobTexts: [], jobIds: [] };
    }
  }

  /**
   * Analyze user and recommend necessary skills based on job market
   * @param {Object} user - User object
   * @param {Array} preFetchedJobs - Optional pre-fetched jobs array for optimization
   * @returns {Object} Recommended skills and analysis
   */
  async analyzeUserSkills(user, preFetchedJobs = null) {
    try {
      // Embed user profile (skip if ChromaDB not available to save time)
      try {
        await this.embedUser(user);
      } catch (embedError) {
        console.warn(`Skipping user embedding for ${user.email}:`, embedError.message);
      }

      // Get all job embeddings (filtered by user's track if available)
      const { jobs, jobTexts } = await this.getAllJobEmbeddings(user.preferredTrack, preFetchedJobs);

      if (jobs.length === 0) {
        return {
          recommendedSkills: [],
          analysis: 'No jobs found in your domain to analyze.',
          reasoning: 'We could not find any jobs in your preferred track to analyze the current job market.',
        };
      }

      // Build context for AI analysis
      const userContext = this.buildUserContext(user);
      const jobMarketContext = this.buildJobMarketContext(jobs);

      // Use AI to determine necessary skills
      const prompt = this.buildAnalysisPrompt(userContext, jobMarketContext);

      const messages = [
        {
          role: 'system',
          content: 'You are a career advisor specializing in skill gap analysis. Analyze user profiles and job market data to recommend essential skills that users need to develop to be competitive in their domain.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const aiResponse = await aiService.generateContent(messages, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      // Parse AI response
      const analysis = this.parseAIResponse(aiResponse);

      return {
        recommendedSkills: analysis.skills || [],
        analysis: analysis.analysis || '',
        reasoning: analysis.reasoning || '',
        priority: analysis.priority || 'medium',
      };
    } catch (error) {
      console.error('Error analyzing user skills:', error);
      throw new Error(`Failed to analyze user skills: ${error.message}`);
    }
  }

  /**
   * Build user context for AI analysis
   * @param {Object} user - User object
   * @returns {String} User context text
   */
  buildUserContext(user) {
    const parts = [];
    
    if (user.fullName) parts.push(`Name: ${user.fullName}`);
    if (user.preferredTrack) parts.push(`Career Track: ${user.preferredTrack}`);
    if (user.experienceLevel) parts.push(`Experience Level: ${user.experienceLevel}`);
    if (user.educationLevel) parts.push(`Education: ${user.educationLevel}`);
    
    if (user.skills && user.skills.length > 0) {
      parts.push(`Current Skills: ${user.skills.join(', ')}`);
    }
    
    if (user.careerInterests && user.careerInterests.length > 0) {
      parts.push(`Career Interests: ${user.careerInterests.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Build job market context from jobs
   * @param {Array} jobs - Array of job objects
   * @returns {String} Job market context text
   */
  buildJobMarketContext(jobs) {
    // Analyze job market trends
    const skillFrequency = {};
    const experienceLevels = {};
    const tracks = {};

    jobs.forEach(job => {
      // Count skill frequency
      if (job.requiredSkills && Array.isArray(job.requiredSkills)) {
        job.requiredSkills.forEach(skill => {
          const normalizedSkill = skill.toLowerCase().trim();
          skillFrequency[normalizedSkill] = (skillFrequency[normalizedSkill] || 0) + 1;
        });
      }

      // Count experience levels
      if (job.experienceLevel) {
        experienceLevels[job.experienceLevel] = (experienceLevels[job.experienceLevel] || 0) + 1;
      }

      // Count tracks
      if (job.track) {
        tracks[job.track] = (tracks[job.track] || 0) + 1;
      }
    });

    // Get top skills
    const topSkills = Object.entries(skillFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([skill, count]) => `${skill} (required in ${count} jobs)`)
      .join(', ');

    const parts = [
      `Total Jobs Analyzed: ${jobs.length}`,
      `Top Required Skills: ${topSkills}`,
      `Experience Level Distribution: ${JSON.stringify(experienceLevels)}`,
    ];

    return parts.join('\n');
  }

  /**
   * Build AI prompt for skill analysis
   * @param {String} userContext - User context
   * @param {String} jobMarketContext - Job market context
   * @returns {String} Complete prompt
   */
  buildAnalysisPrompt(userContext, jobMarketContext) {
    return `Analyze the following user profile and current job market data to recommend essential skills they should develop.

USER PROFILE:
${userContext}

CURRENT JOB MARKET ANALYSIS:
${jobMarketContext}

Based on this analysis, please:
1. Identify 3-5 essential skills that the user should develop to be competitive in their domain
2. Explain why each skill is important based on the job market data
3. Prioritize the skills (high/medium/low priority)
4. Provide actionable advice on how to acquire these skills

Respond in the following JSON format:
{
  "skills": ["skill1", "skill2", "skill3"],
  "analysis": "Brief analysis of why these skills are important",
  "reasoning": "Detailed reasoning for each skill recommendation",
  "priority": "high|medium|low"
}`;
  }

  /**
   * Parse AI response to extract structured data
   * @param {String} aiResponse - Raw AI response
   * @returns {Object} Parsed analysis
   */
  parseAIResponse(aiResponse) {
    try {
      // Ensure aiResponse is a string
      const responseText = typeof aiResponse === 'string' ? aiResponse : String(aiResponse || '');
      
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure all fields are strings
        return {
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          analysis: typeof parsed.analysis === 'string' ? parsed.analysis : String(parsed.analysis || ''),
          reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : String(parsed.reasoning || ''),
          priority: typeof parsed.priority === 'string' ? parsed.priority : 'medium',
        };
      }

      // Fallback: extract skills from text
      const skills = [];
      const skillPattern = /["']([^"']+)["']/g;
      let match;
      while ((match = skillPattern.exec(responseText)) !== null && skills.length < 5) {
        skills.push(match[1]);
      }

      return {
        skills: skills.length > 0 ? skills : [],
        analysis: responseText.substring(0, 200),
        reasoning: responseText,
        priority: 'medium',
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      const responseText = typeof aiResponse === 'string' ? aiResponse : String(aiResponse || '');
      return {
        skills: [],
        analysis: 'Unable to parse AI response',
        reasoning: responseText || 'No reasoning available',
        priority: 'medium',
      };
    }
  }
}

module.exports = new SkillRecommendationAgent();

