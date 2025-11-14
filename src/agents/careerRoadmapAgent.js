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
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Step 1: Analyze current state vs target role
      const gapAnalysis = await this.analyzeCurrentVsTarget(user, targetRole);

      // Step 2: Get relevant jobs for target role to understand requirements
      const targetJobRequirements = await this.getTargetRoleRequirements(targetRole);

      // Step 3: Generate roadmap using AI
      const roadmapData = await this.generateAIRoadmap(
        user,
        targetRole,
        timeframe,
        availableHours,
        gapAnalysis,
        targetJobRequirements
      );

      // Step 4: Enhance roadmap with database resources
      const enhancedRoadmap = await this.enhanceRoadmapWithResources(roadmapData, user);

      // Step 5: Save roadmap to database
      const savedRoadmap = await this.saveRoadmap(userId, targetRole, timeframe, enhancedRoadmap);

      return {
        roadmapId: savedRoadmap._id,
        ...enhancedRoadmap,
        generatedAt: savedRoadmap.generatedAt,
      };
    } catch (error) {
      console.error('Career Roadmap Agent Error:', error);
      throw new Error(`Failed to generate roadmap: ${error.message}`);
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
      // Embed target role for semantic matching
      if (chromaService.collection) {
        await chromaService.collection.add({
          ids: [`role_${targetRole.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`],
          documents: [`Target Role: ${targetRole}. Requirements: Professional skills, experience, and knowledge needed for this position.`],
          metadatas: [{
            type: 'role',
            role: targetRole,
          }],
        });
      }

      // OPTIMIZATION: Use semantic search instead of regex for better role matching
      let similarJobs = [];
      try {
        if (chromaService.collection) {
          // Use semantic search to find similar roles
          const roleQueryResults = await chromaService.collection.query({
            queryTexts: [targetRole],
            nResults: 10,
            where: { type: 'job' },
          });

          if (roleQueryResults.metadatas && roleQueryResults.metadatas[0]) {
            const jobIds = roleQueryResults.metadatas[0]
              .map(meta => meta.jobId)
              .filter(Boolean);
            
            if (jobIds.length > 0) {
              similarJobs = await Job.find({ _id: { $in: jobIds } })
                .select('title company requiredSkills experienceLevel track')
                .lean()
                .limit(10);
            }
          }
        }
      } catch (error) {
        console.warn('Semantic role search failed, using regex fallback:', error.message);
      }

      // Fallback to regex if semantic search didn't find enough jobs
      if (similarJobs.length < 5) {
        const regexJobs = await Job.find({
          $or: [
            { title: { $regex: new RegExp(targetRole, 'i') } },
            { track: { $regex: new RegExp(targetRole, 'i') } },
          ],
        })
        .select('title company requiredSkills experienceLevel track')
        .lean()
        .limit(10);
        
        // Merge and deduplicate
        const existingIds = new Set(similarJobs.map(j => j._id.toString()));
        const additionalJobs = regexJobs.filter(j => !existingIds.has(j._id.toString()));
        similarJobs = [...similarJobs, ...additionalJobs].slice(0, 10);
      }

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
      const jobs = await Job.find({
        $or: [
          { title: { $regex: new RegExp(targetRole, 'i') } },
          { track: { $regex: new RegExp(targetRole, 'i') } },
        ],
      }).limit(20);

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
      // OPTIMIZATION: Few-shot examples for better roadmap generation
      const prompt = `You are an expert career mentor creating a personalized ${timeframe}-month career roadmap.

FEW-SHOT EXAMPLES (Learn from these correct roadmap generations):

Example 1 - 6-Month Roadmap for Frontend Developer:
User: Fresher, Skills: HTML, CSS, JavaScript
Target: Frontend Developer

Correct Roadmap:
{
  "targetRole": "Frontend Developer",
  "timeframe": 6,
  "phases": [
    {
      "month": 1,
      "title": "Phase 1: React Fundamentals",
      "objectives": [
        "Master React components and JSX syntax",
        "Understand props and state management",
        "Build basic interactive components"
      ],
      "skillsToLearn": ["React", "JSX", "Props", "State"],
      "projects": [
        {
          "name": "Todo List App",
          "description": "Build a functional todo list with add, edit, delete, and filter features using React",
          "technologies": ["React", "CSS", "JavaScript"],
          "difficulty": "Beginner"
        }
      ],
      "milestones": [
        "Complete React official tutorial",
        "Build first React component",
        "Deploy todo app to GitHub Pages"
      ],
      "estimatedHours": 40
    },
    {
      "month": 2,
      "title": "Phase 2: Advanced React Concepts",
      "objectives": [
        "Master React Hooks (useState, useEffect, useContext)",
        "Learn component lifecycle and optimization",
        "Implement routing with React Router"
      ],
      "skillsToLearn": ["React Hooks", "React Router", "Context API"],
      "projects": [
        {
          "name": "Weather Dashboard",
          "description": "Create a weather app with multiple city search, using React Router for navigation and API integration",
          "technologies": ["React", "React Router", "API Integration", "CSS"],
          "difficulty": "Intermediate"
        }
      ],
      "milestones": [
        "Implement hooks in all components",
        "Add routing to weather app",
        "Optimize component performance"
      ],
      "estimatedHours": 40
    }
  ],
  "applicationTimeline": "Start applying in month 5",
  "portfolioTips": [
    "Showcase 3-4 completed projects with live demos",
    "Include code quality: clean, commented, and well-structured",
    "Add project descriptions explaining your thought process",
    "Include GitHub links with active repositories",
    "Add testimonials or metrics (e.g., 'Improved performance by 40%')"
  ],
  "interviewPrep": [
    "Practice explaining your projects and technical decisions",
    "Study common React interview questions (hooks, lifecycle, state management)",
    "Prepare for coding challenges on platforms like LeetCode",
    "Practice system design questions for frontend architecture",
    "Prepare questions to ask interviewers about team and tech stack"
  ]
}

Example 2 - 3-Month Roadmap for Data Analyst:
User: Junior, Skills: Python, SQL, Excel
Target: Data Analyst

Correct Roadmap:
{
  "targetRole": "Data Analyst",
  "timeframe": 3,
  "phases": [
    {
      "month": 1,
      "title": "Phase 1: Data Analysis Foundations",
      "objectives": [
        "Master pandas for data manipulation",
        "Learn data visualization with matplotlib and seaborn",
        "Practice with real datasets"
      ],
      "skillsToLearn": ["Pandas", "Matplotlib", "Seaborn", "Data Cleaning"],
      "projects": [
        {
          "name": "Sales Data Analysis",
          "description": "Analyze sales data to identify trends, top products, and revenue patterns using pandas and visualization",
          "technologies": ["Python", "Pandas", "Matplotlib", "Jupyter"],
          "difficulty": "Beginner"
        }
      ],
      "milestones": [
        "Complete pandas tutorial",
        "Create first data visualization",
        "Publish analysis on GitHub"
      ],
      "estimatedHours": 30
    }
  ],
  "applicationTimeline": "Start applying in month 2",
  "portfolioTips": [
    "Create a portfolio website showcasing your analyses",
    "Include interactive visualizations using Tableau or Power BI",
    "Document your analysis process and insights",
    "Share your work on LinkedIn and Kaggle"
  ],
  "interviewPrep": [
    "Practice SQL queries for data extraction",
    "Prepare to explain your analysis methodology",
    "Study statistical concepts (mean, median, correlation)",
    "Practice presenting data insights clearly"
  ]
}

USER PROFILE:
- Current Skills: ${(user.skills || []).join(', ') || 'None listed'}
- Experience Level: ${user.experienceLevel || 'Fresher'}
- Preferred Track: ${user.preferredTrack || 'Not specified'}
- Education: ${user.educationLevel || 'Not specified'}
- Career Interests: ${(user.careerInterests || []).join(', ') || 'None'}

TARGET ROLE: ${targetRole}
TIMEFRAME: ${timeframe} months
AVAILABLE LEARNING TIME: ${availableHours} hours per week

GAP ANALYSIS:
- Missing Skills: ${gapAnalysis.missingSkills.join(', ') || 'None'}
- Experience Gap: ${gapAnalysis.experienceGap}
- Track Alignment: ${gapAnalysis.trackAlignment}

TARGET ROLE REQUIREMENTS:
- Common Skills: ${targetJobRequirements.commonSkills.join(', ') || 'None'}
- Typical Experience: ${targetJobRequirements.typicalExperience}
- Typical Job Type: ${targetJobRequirements.typicalJobType}

Create a comprehensive, actionable roadmap with:

1. ${timeframe} monthly phases (one phase per month)
2. Each phase must include:
   - month: (1, 2, 3, etc.)
   - title: Descriptive phase title (e.g., "Phase 1: Foundation Building", "Phase 2: Advanced Concepts")
   - objectives: 2-4 specific, measurable learning objectives
   - skillsToLearn: Specific skills/technologies to learn in this phase
   - projects: 1-2 project ideas with:
     * name: Project name
     * description: Detailed description of what to build (2-3 sentences)
     * technologies: Technologies to use (array)
     * difficulty: Beginner/Intermediate/Advanced
   - milestones: 2-3 key milestones to achieve (specific, measurable)
   - estimatedHours: Total hours for this phase (based on ${availableHours} hours/week, typically ${availableHours * 4} hours/month)

3. Application Timeline: When to start applying (e.g., "Start applying in month ${Math.max(1, timeframe - 1)}")
4. Portfolio Tips: 3-5 actionable tips for building a strong portfolio
5. Interview Prep: 3-5 interview preparation tips specific to ${targetRole}

IMPORTANT GUIDELINES:
- Make it realistic and achievable for ${user.experienceLevel || 'Fresher'} level
- Focus on practical, hands-on learning with real projects
- Progress from basics to advanced concepts logically
- Each phase should build on the previous one
- Projects should be portfolio-worthy and demonstrate skills
- Estimated hours should be realistic (${availableHours} hours/week = ${availableHours * 4} hours/month)
- Align with SDG 8 goals (decent work and economic growth)
- Consider the user's current skill level: ${user.experienceLevel || 'Fresher'}
- Include real-world, industry-relevant projects

Return JSON:
{
  "targetRole": "${targetRole}",
  "timeframe": ${timeframe},
  "phases": [
    {
      "month": 1,
      "title": "Phase 1: Foundation",
      "objectives": ["obj1", "obj2", "obj3"],
      "skillsToLearn": ["skill1", "skill2"],
      "projects": [
        {
          "name": "Project Name",
          "description": "Detailed description of what to build",
          "technologies": ["tech1", "tech2"],
          "difficulty": "Beginner"
        }
      ],
      "milestones": ["milestone1", "milestone2"],
      "estimatedHours": ${availableHours * 4}
    }
  ],
  "applicationTimeline": "Start applying in month ${Math.max(1, timeframe - 1)}",
  "portfolioTips": ["tip1", "tip2", "tip3"],
  "interviewPrep": ["prep1", "prep2", "prep3"]
}

Return ONLY valid JSON, no markdown, no code blocks.`;

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
        temperature: 0.7, // OPTIMIZATION: Higher temperature for creative roadmap generation
        maxTokens: 2500,   // OPTIMIZATION: Sufficient for comprehensive roadmap with multiple phases
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

