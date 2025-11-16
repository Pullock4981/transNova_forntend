const chromaService = require('../services/chromaService');
const aiService = require('../services/aiService');
const Roadmap = require('../models/Roadmap');
const Job = require('../models/Job');
const Resource = require('../models/Resource');

/**
 * Career Roadmap Agent
 * 
 * Purpose: Generates personalized, AI-powered career roadmaps for users
 *          to transition from their current state to target roles
 * 
 * Responsibilities:
 * - Analyzes user's current skills, experience, and goals
 * - Generates step-by-step learning roadmaps with phases/months
 * - Provides specific topics, technologies, and project ideas
 * - Suggests optimal timeline for job applications
 * - Embeds skills and roles into ChromaDB for semantic matching
 * - Saves and retrieves roadmaps for logged-in users
 * 
 * Usage:
 *   const agent = require('./agents/careerRoadmapAgent');
 *   await agent.initialize();
 *   const roadmap = await agent.generateRoadmap(userId, targetRole, timeframe, availableHours);
 *   const savedRoadmaps = await agent.getUserRoadmaps(userId);
 */
class CareerRoadmapAgent {
  /**
   * Initialize the agent and ChromaDB connection
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
  }

  /**
   * Generate a comprehensive career roadmap
   * 
   * @param {String} userId - User's MongoDB _id
   * @param {String} targetRole - Target role (e.g., "Frontend Developer", "Data Analyst")
   * @param {Number} timeframe - Timeframe in months (1-24)
   * @param {Number} availableHours - Available learning hours per week (optional)
   * @returns {Object} Generated roadmap with phases, projects, and timeline
   */
  async generateRoadmap(userId, targetRole, timeframe = 6, availableHours = 10) {
    try {
      await this.initialize();

      const User = require('../models/User');
      // OPTIMIZATION: Use lean() for faster query
      const user = await User.findById(userId).lean();

      if (!user) {
        throw new Error('User not found');
      }

      // OPTIMIZATION: Generate fast template-based roadmap immediately (2-3 sec)
      const templateRoadmap = this.generateFastTemplateRoadmap(
        user,
        targetRole,
        timeframe,
        availableHours
      );

      // Save template roadmap immediately
      const savedRoadmap = await this.saveRoadmap(userId, targetRole, timeframe, templateRoadmap);

      // OPTIMIZATION: Enhance with AI in background (non-blocking)
      this.enhanceRoadmapWithAI(user, targetRole, timeframe, availableHours, savedRoadmap._id)
        .catch(err => console.warn('Background AI enhancement failed:', err));

      return {
        roadmapId: savedRoadmap._id,
        ...templateRoadmap,
        generatedAt: savedRoadmap.generatedAt,
      };
    } catch (error) {
      console.error('Career Roadmap Agent Error:', error);
      throw new Error(`Failed to generate roadmap: ${error.message}`);
    }
  }

  /**
   * Generate fast template-based roadmap (2-3 seconds)
   * Returns immediately, AI enhancement happens in background
   */
  generateFastTemplateRoadmap(user, targetRole, timeframe, availableHours) {
    const userSkills = user.skills || [];
    const experienceLevel = user.experienceLevel || 'Fresher';
    
    // Common skills for the target role (simplified lookup)
    const roleSkillMap = {
      'frontend': ['React', 'JavaScript', 'HTML', 'CSS', 'TypeScript', 'Next.js'],
      'backend': ['Node.js', 'Python', 'Express', 'MongoDB', 'REST API', 'SQL'],
      'fullstack': ['React', 'Node.js', 'MongoDB', 'Express', 'JavaScript', 'TypeScript'],
      'data': ['Python', 'Pandas', 'SQL', 'Data Analysis', 'Visualization', 'Machine Learning'],
      'design': ['Figma', 'UI/UX Design', 'Adobe XD', 'Prototyping', 'User Research'],
    };

    const targetLower = targetRole.toLowerCase();
    let targetSkills = [];
    for (const [key, skills] of Object.entries(roleSkillMap)) {
      if (targetLower.includes(key)) {
        targetSkills = skills;
        break;
      }
    }

    // If no match, use generic skills
    if (targetSkills.length === 0) {
      targetSkills = ['Core Concepts', 'Fundamentals', 'Best Practices', 'Tools', 'Projects'];
    }

    // Find missing skills
    const missingSkills = targetSkills.filter(skill =>
      !userSkills.some(us => us.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(us.toLowerCase()))
    );

    // Generate phases
    const phases = [];
    const skillsPerPhase = Math.max(1, Math.ceil(missingSkills.length / timeframe));
    
    for (let month = 1; month <= timeframe; month++) {
      const startIdx = (month - 1) * skillsPerPhase;
      const endIdx = Math.min(startIdx + skillsPerPhase, missingSkills.length);
      const phaseSkills = missingSkills.slice(startIdx, endIdx);
      
      const difficulty = month <= Math.ceil(timeframe / 3) ? 'Beginner' : 
                        month <= Math.ceil(timeframe * 2 / 3) ? 'Intermediate' : 'Advanced';

      phases.push({
        month,
        title: `Phase ${month}: ${phaseSkills[0] || 'Foundation Building'}`,
        objectives: [
          `Master ${phaseSkills[0] || 'core concepts'}`,
          `Build practical projects using ${phaseSkills[0] || 'new skills'}`,
          `Apply knowledge to real-world scenarios`,
        ],
        skillsToLearn: phaseSkills.length > 0 ? phaseSkills : ['Fundamentals', 'Best Practices'],
        projects: [
          {
            name: `${targetRole} Project ${month}`,
            description: `Build a ${targetRole.toLowerCase()} project demonstrating ${phaseSkills[0] || 'key skills'} and best practices. Focus on creating a portfolio-worthy piece that showcases your learning.`,
            technologies: phaseSkills.length > 0 ? phaseSkills : ['Core Technologies'],
            difficulty,
          },
        ],
        milestones: [
          `Complete ${phaseSkills[0] || 'fundamental'} learning`,
          `Finish and deploy project ${month}`,
          `Document your learning journey`,
        ],
        estimatedHours: availableHours * 4,
      });
    }

    return {
      targetRole,
      timeframe,
      phases,
      applicationTimeline: `Start applying in month ${Math.max(1, timeframe - 1)}`,
      portfolioTips: [
        'Showcase 3-4 completed projects with live demos',
        'Include clean, well-documented code on GitHub',
        'Write clear project descriptions explaining your approach',
        'Highlight your learning journey and growth',
        'Add metrics or results where possible',
      ],
      interviewPrep: [
        'Practice explaining your projects and technical decisions',
        'Study common interview questions for your role',
        'Prepare for coding challenges and technical discussions',
        'Research companies and roles you\'re applying to',
        'Prepare thoughtful questions to ask interviewers',
      ],
    };
  }

  /**
   * Enhance roadmap with AI in background
   */
  async enhanceRoadmapWithAI(user, targetRole, timeframe, availableHours, roadmapId) {
    try {
      // Quick gap analysis (with timeout)
      const [gapAnalysis, targetJobRequirements] = await Promise.all([
        Promise.race([
          this.analyzeCurrentVsTarget(user, targetRole),
          new Promise((resolve) => setTimeout(() => resolve({
            currentSkills: user.skills || [],
            targetSkills: [],
            missingSkills: [],
            experienceGap: 'moderate',
            trackAlignment: 'partial',
          }), 500))
        ]),
        Promise.race([
          this.getTargetRoleRequirements(targetRole),
          new Promise((resolve) => setTimeout(() => resolve({
            commonSkills: [],
            typicalExperience: 'Mid',
            typicalJobType: 'Full-time',
            jobCount: 0,
          }), 500))
        ]),
      ]);

      // Generate AI-enhanced roadmap
      const aiRoadmap = await this.generateAIRoadmap(
        user,
        targetRole,
        timeframe,
        availableHours,
        gapAnalysis,
        targetJobRequirements
      );

      // Enhance with resources
      const enhancedRoadmap = await this.enhanceRoadmapWithResources(aiRoadmap, user);

      // Update saved roadmap with AI-enhanced version
      await Roadmap.findByIdAndUpdate(roadmapId, {
        phases: enhancedRoadmap.phases,
        applicationTimeline: enhancedRoadmap.applicationTimeline,
        portfolioTips: enhancedRoadmap.portfolioTips,
        interviewPrep: enhancedRoadmap.interviewPrep,
      });
    } catch (error) {
      console.warn('AI enhancement failed:', error.message);
      // Silently fail - template roadmap is already saved
    }
  }

  /**
   * Analyze gap between user's current state and target role
   * 
   * @param {Object} user - User profile
   * @param {String} targetRole - Target role
   * @returns {Object} Gap analysis
   */
  async analyzeCurrentVsTarget(user, targetRole) {
    try {
      // OPTIMIZATION: Skip ChromaDB entirely - use fast regex query only
      const similarJobs = await Job.find({
        $or: [
          { title: { $regex: new RegExp(targetRole, 'i') } },
          { track: { $regex: new RegExp(targetRole, 'i') } },
        ],
      })
      .select('requiredSkills experienceLevel track')
      .lean()
      .limit(5); // OPTIMIZATION: Only need 5 jobs for skill extraction

      const commonRequiredSkills = this.extractCommonSkills(similarJobs);
      const userSkills = user.skills || [];
      const missingSkills = commonRequiredSkills.filter(skill =>
        !userSkills.some(us => us.toLowerCase() === skill.toLowerCase())
      );

      return {
        currentSkills: userSkills,
        targetSkills: commonRequiredSkills,
        missingSkills,
        experienceGap: this.assessExperienceGap(user.experienceLevel, similarJobs),
        trackAlignment: this.assessTrackAlignment(user.preferredTrack, targetRole),
      };
    } catch (error) {
      console.error('Gap Analysis Error:', error);
      return {
        currentSkills: user.skills || [],
        targetSkills: [],
        missingSkills: [],
        experienceGap: 'moderate',
        trackAlignment: 'partial',
      };
    }
  }

  /**
   * Extract common required skills from similar jobs
   * 
   * @param {Array} jobs - Array of job objects
   * @returns {Array} Common skills
   */
  extractCommonSkills(jobs) {
    if (jobs.length === 0) return [];

    const skillCounts = {};
    jobs.forEach(job => {
      (job.requiredSkills || []).forEach(skill => {
        const skillLower = skill.toLowerCase();
        skillCounts[skillLower] = (skillCounts[skillLower] || 0) + 1;
      });
    });

    // Return skills that appear in at least 30% of jobs
    const threshold = Math.ceil(jobs.length * 0.3);
    return Object.entries(skillCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([skill, _]) => skill)
      .sort((a, b) => skillCounts[b] - skillCounts[a]);
  }

  /**
   * Assess experience gap between user and target role
   * 
   * @param {String} userExperience - User's experience level
   * @param {Array} jobs - Similar jobs
   * @returns {String} Gap assessment
   */
  assessExperienceGap(userExperience, jobs) {
    if (jobs.length === 0) return 'unknown';

    const experienceLevels = { 'Fresher': 1, 'Junior': 2, 'Mid': 3, 'Senior': 4 };
    const userLevel = experienceLevels[userExperience] || 1;
    
    const jobLevels = jobs.map(job => experienceLevels[job.experienceLevel] || 1);
    const avgJobLevel = jobLevels.reduce((a, b) => a + b, 0) / jobLevels.length;

    if (userLevel >= avgJobLevel) return 'none';
    if (userLevel >= avgJobLevel - 1) return 'small';
    if (userLevel >= avgJobLevel - 2) return 'moderate';
    return 'large';
  }

  /**
   * Assess track alignment
   * 
   * @param {String} userTrack - User's preferred track
   * @param {String} targetRole - Target role
   * @returns {String} Alignment level
   */
  assessTrackAlignment(userTrack, targetRole) {
    if (!userTrack) return 'unknown';

    const userTrackLower = userTrack.toLowerCase();
    const targetRoleLower = targetRole.toLowerCase();

    if (targetRoleLower.includes(userTrackLower) || userTrackLower.includes(targetRoleLower)) {
      return 'high';
    }

    // Check for related tracks
    const relatedTracks = {
      'web development': ['frontend', 'backend', 'fullstack'],
      'data science': ['data analyst', 'data engineer', 'ml engineer'],
      'design': ['ui/ux', 'graphic design', 'product design'],
    };

    for (const [track, related] of Object.entries(relatedTracks)) {
      if (userTrackLower.includes(track) || track.includes(userTrackLower)) {
        if (related.some(rt => targetRoleLower.includes(rt))) {
          return 'moderate';
        }
      }
    }

    return 'low';
  }

  /**
   * Get target role requirements from job database
   * 
   * @param {String} targetRole - Target role
   * @returns {Object} Role requirements
   */
  async getTargetRoleRequirements(targetRole) {
    try {
      // OPTIMIZATION: Use lean() and limit for faster query
      const jobs = await Job.find({
        $or: [
          { title: { $regex: new RegExp(targetRole, 'i') } },
          { track: { $regex: new RegExp(targetRole, 'i') } },
        ],
      })
      .select('requiredSkills experienceLevel jobType')
      .lean()
      .limit(5); // OPTIMIZATION: Reduced from 10 to 5 for speed

      const allSkills = [];
      const allExperienceLevels = [];
      const allJobTypes = [];

      jobs.forEach(job => {
        allSkills.push(...(job.requiredSkills || []));
        allExperienceLevels.push(job.experienceLevel);
        allJobTypes.push(job.jobType);
      });

      return {
        commonSkills: this.extractCommonSkills(jobs),
        typicalExperience: this.getMostCommon(allExperienceLevels),
        typicalJobType: this.getMostCommon(allJobTypes),
        jobCount: jobs.length,
      };
    } catch (error) {
      console.error('Get Role Requirements Error:', error);
      return {
        commonSkills: [],
        typicalExperience: 'Mid',
        typicalJobType: 'Full-time',
        jobCount: 0,
      };
    }
  }

  /**
   * Get most common value from array
   * 
   * @param {Array} arr - Array of values
   * @returns {String} Most common value
   */
  getMostCommon(arr) {
    if (arr.length === 0) return null;
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Generate AI-powered roadmap
   * 
   * @param {Object} user - User profile
   * @param {String} targetRole - Target role
   * @param {Number} timeframe - Timeframe in months
   * @param {Number} availableHours - Available hours per week
   * @param {Object} gapAnalysis - Gap analysis results
   * @param {Object} targetJobRequirements - Target role requirements
   * @returns {Object} Roadmap data
   */
  async generateAIRoadmap(user, targetRole, timeframe, availableHours, gapAnalysis, targetJobRequirements) {
    try {
      // OPTIMIZATION: Minimal prompt for fastest AI generation
      const missingSkills = gapAnalysis.missingSkills.slice(0, 8).join(', ') || 'None';
      const commonSkills = targetJobRequirements.commonSkills.slice(0, 8).join(', ') || 'None';
      
      const prompt = `Create a ${timeframe}-month career roadmap for ${targetRole}.

User: ${user.experienceLevel || 'Fresher'} level, Skills: ${(user.skills || []).slice(0, 10).join(', ') || 'None'}
Missing Skills: ${missingSkills}
Target Skills: ${commonSkills}
Time: ${availableHours} hours/week

Return JSON with ${timeframe} phases. Each phase: month, title, objectives (2-3), skillsToLearn (3-5), projects (1-2 with name, description, technologies, difficulty), milestones (2-3), estimatedHours (${availableHours * 4}).
Also include: applicationTimeline, portfolioTips (3-4), interviewPrep (3-4).

Make it practical for ${user.experienceLevel || 'Fresher'} level. Return ONLY valid JSON, no markdown.`;

      // OPTIMIZATION: Schema validation and task-specific temperature/tokens
      const roadmapData = await aiService.generateStructuredJSON(prompt, {
        type: 'object',
        properties: {
          targetRole: { type: 'string' },
          timeframe: { type: 'number' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                month: { type: 'number' },
                title: { type: 'string' },
                objectives: { type: 'array', items: { type: 'string' } },
                skillsToLearn: { type: 'array', items: { type: 'string' } },
                projects: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      technologies: { type: 'array', items: { type: 'string' } },
                      difficulty: { type: 'string' },
                    },
                    required: ['name', 'description', 'technologies', 'difficulty'],
                  },
                },
                milestones: { type: 'array', items: { type: 'string' } },
                estimatedHours: { type: 'number' },
              },
              required: ['month', 'title', 'objectives', 'skillsToLearn', 'projects', 'milestones', 'estimatedHours'],
            },
          },
          applicationTimeline: { type: 'string' },
          portfolioTips: { type: 'array', items: { type: 'string' } },
          interviewPrep: { type: 'array', items: { type: 'string' } },
        },
        required: ['targetRole', 'timeframe', 'phases', 'applicationTimeline', 'portfolioTips', 'interviewPrep'],
      }, {
        temperature: 0.7,
        maxTokens: 1200, // OPTIMIZATION: Further reduced to 1200 for faster generation
      });

      // Validate structure
      if (!roadmapData.phases || !Array.isArray(roadmapData.phases)) {
        throw new Error('Invalid roadmap structure from AI');
      }

      // Ensure phases match timeframe
      if (roadmapData.phases.length !== timeframe) {
        // Adjust phases to match timeframe
        if (roadmapData.phases.length < timeframe) {
          // Duplicate last phase or create new ones
          const lastPhase = roadmapData.phases[roadmapData.phases.length - 1];
          while (roadmapData.phases.length < timeframe) {
            roadmapData.phases.push({
              ...lastPhase,
              month: roadmapData.phases.length + 1,
              title: `Phase ${roadmapData.phases.length + 1}: ${lastPhase.title}`,
            });
          }
        } else {
          // Trim to timeframe
          roadmapData.phases = roadmapData.phases.slice(0, timeframe);
        }
      }

      return roadmapData;
    } catch (error) {
      console.error('AI Roadmap Generation Error:', error);
      // Fallback to template-based roadmap
      return this.generateFallbackRoadmap(user, targetRole, timeframe, availableHours, gapAnalysis);
    }
  }

  /**
   * Enhance roadmap with database resources
   * 
   * @param {Object} roadmapData - Roadmap data
   * @param {Object} user - User profile
   * @returns {Object} Enhanced roadmap
   */
  async enhanceRoadmapWithResources(roadmapData, user) {
    try {
      // Get all skills from all phases
      const allSkills = [];
      roadmapData.phases.forEach(phase => {
        allSkills.push(...(phase.skillsToLearn || []));
      });

      // Get resources for these skills
      const resources = await Resource.find({
        $or: allSkills.map(skill => ({
          relatedSkills: { $regex: new RegExp(skill, 'i') }
        }))
      }).limit(30);

      // Map resources to phases
      roadmapData.phases = roadmapData.phases.map(phase => {
        const phaseResources = resources.filter(resource =>
          (phase.skillsToLearn || []).some(skill =>
            resource.relatedSkills.some(rs =>
              rs.toLowerCase().includes(skill.toLowerCase()) ||
              skill.toLowerCase().includes(rs.toLowerCase())
            )
          )
        );

        return {
          ...phase,
          resources: phaseResources.map(r => ({
            title: r.title,
            platform: r.platform,
            url: r.url,
            cost: r.cost,
            relatedSkills: r.relatedSkills,
          })),
        };
      });

      return roadmapData;
    } catch (error) {
      console.error('Enhance Roadmap Error:', error);
      return roadmapData; // Return original if enhancement fails
    }
  }

  /**
   * Generate fallback roadmap when AI fails
   * 
   * @param {Object} user - User profile
   * @param {String} targetRole - Target role
   * @param {Number} timeframe - Timeframe
   * @param {Number} availableHours - Available hours
   * @param {Object} gapAnalysis - Gap analysis
   * @returns {Object} Fallback roadmap
   */
  generateFallbackRoadmap(user, targetRole, timeframe, availableHours, gapAnalysis) {
    const phases = [];
    const missingSkills = gapAnalysis.missingSkills || [];

    for (let month = 1; month <= timeframe; month++) {
      const skillsPerMonth = Math.ceil(missingSkills.length / timeframe);
      const startIdx = (month - 1) * skillsPerMonth;
      const endIdx = Math.min(startIdx + skillsPerMonth, missingSkills.length);
      const monthSkills = missingSkills.slice(startIdx, endIdx);

      phases.push({
        month,
        title: `Phase ${month}: Learning ${monthSkills.join(', ') || 'Fundamentals'}`,
        objectives: [
          `Learn ${monthSkills[0] || 'core concepts'}`,
          `Build a project using ${monthSkills[0] || 'new skills'}`,
          `Complete practice exercises`,
        ],
        skillsToLearn: monthSkills.length > 0 ? monthSkills : ['Fundamentals'],
        projects: [
          {
            name: `${targetRole} Project ${month}`,
            description: `Build a project demonstrating ${monthSkills[0] || 'new skills'}`,
            technologies: monthSkills,
            difficulty: month <= Math.ceil(timeframe / 2) ? 'Beginner' : 'Intermediate',
          },
        ],
        milestones: [
          `Complete ${monthSkills[0] || 'fundamental'} learning`,
          `Finish project ${month}`,
        ],
        estimatedHours: availableHours * 4, // 4 weeks per month
      });
    }

    return {
      targetRole,
      timeframe,
      phases,
      applicationTimeline: `Start applying in month ${Math.max(1, timeframe - 1)}`,
      portfolioTips: [
        'Showcase your best projects',
        'Include code samples and live demos',
        'Write clear project descriptions',
        'Highlight your learning journey',
      ],
      interviewPrep: [
        'Practice common interview questions',
        'Prepare examples of your work',
        'Research the company and role',
        'Practice explaining your projects',
      ],
    };
  }

  /**
   * Save roadmap to database
   * 
   * @param {String} userId - User ID
   * @param {String} targetRole - Target role
   * @param {Number} timeframe - Timeframe
   * @param {Object} roadmapData - Roadmap data
   * @returns {Object} Saved roadmap
   */
  async saveRoadmap(userId, targetRole, timeframe, roadmapData) {
    try {
      const roadmap = await Roadmap.findOneAndUpdate(
        { userId, targetRole },
        {
          userId,
          targetRole,
          timeframe,
          phases: roadmapData.phases,
          applicationTimeline: roadmapData.applicationTimeline,
          portfolioTips: roadmapData.portfolioTips || [],
          interviewPrep: roadmapData.interviewPrep || [],
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return roadmap;
    } catch (error) {
      console.error('Save Roadmap Error:', error);
      throw new Error(`Failed to save roadmap: ${error.message}`);
    }
  }

  /**
   * Get all roadmaps for a user
   * 
   * @param {String} userId - User ID
   * @returns {Array} User's roadmaps
   */
  async getUserRoadmaps(userId) {
    try {
      return await Roadmap.find({ userId }).sort({ generatedAt: -1 });
    } catch (error) {
      console.error('Get User Roadmaps Error:', error);
      return [];
    }
  }

  /**
   * Get roadmap by ID
   * 
   * @param {String} roadmapId - Roadmap ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Object} Roadmap
   */
  async getRoadmapById(roadmapId, userId) {
    try {
      const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
      if (!roadmap) {
        throw new Error('Roadmap not found or access denied');
      }
      return roadmap;
    } catch (error) {
      console.error('Get Roadmap By ID Error:', error);
      throw error;
    }
  }

  /**
   * Delete roadmap
   * 
   * @param {String} roadmapId - Roadmap ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Object} Deleted roadmap
   */
  async deleteRoadmap(roadmapId, userId) {
    try {
      const roadmap = await Roadmap.findOneAndDelete({ _id: roadmapId, userId });
      if (!roadmap) {
        throw new Error('Roadmap not found or access denied');
      }
      return roadmap;
    } catch (error) {
      console.error('Delete Roadmap Error:', error);
      throw error;
    }
  }
}

module.exports = new CareerRoadmapAgent();

