const chromaService = require('../services/chromaService');
const aiService = require('../services/aiService');
const Resource = require('../models/Resource');

/**
 * Skill Gap Analysis Agent
 * 
 * Purpose: Identifies skill gaps between user profile and job requirements, 
 *          and recommends personalized learning resources to close those gaps
 * 
 * Responsibilities:
 * - Analyzes missing skills using exact matching and semantic similarity (ChromaDB)
 * - Prioritizes skill gaps based on job requirements and career goals
 * - Recommends learning resources from database and AI-generated suggestions
 * - Provides learning paths with estimated time and project ideas
 * - Embeds skills and resources into ChromaDB for semantic search
 * 
 * Usage:
 *   const agent = require('./agents/skillGapAnalysisAgent');
 *   await agent.initialize();
 *   const analysis = await agent.analyzeSkillGaps(user, job);
 *   const recommendations = await agent.getLearningRecommendations(missingSkills, user);
 */
class SkillGapAnalysisAgent {
  /**
   * Initialize the agent and ChromaDB connection
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
  }

  /**
   * Analyze skill gaps between user and job requirements
   * OPTIMIZED: Instant response (<100ms) - pure synchronous computation
   * 
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Object} Skill gap analysis with missing skills and recommendations
   */
  async analyzeSkillGaps(user, job) {
    try {
      const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
      const jobRequiredSkills = (job.requiredSkills || []).map(s => s.toLowerCase().trim());

      // OPTIMIZATION: Fast exact matching only (skip ChromaDB for speed)
      const exactMissingSkills = jobRequiredSkills.filter(
        jobSkill => !userSkills.some(
          userSkill => userSkill === jobSkill || 
          userSkill.includes(jobSkill) || 
          jobSkill.includes(userSkill)
        )
      );

      // OPTIMIZATION: Fast prioritization (synchronous, no async needed)
      const prioritizedSkills = this.prioritizeSkills(exactMissingSkills, job, user);

      // OPTIMIZATION: Generate instant template recommendations (NO database/AI wait)
      // This is now completely synchronous - returns immediately
      const fastRecommendations = prioritizedSkills.map(({ skill, priority, isCore }) => ({
        skill,
        priority,
        isCore,
        resources: this.getFallbackResources(skill).map(r => ({
          ...r,
          source: 'template',
        })),
        estimatedTime: this.estimateLearningTime(skill),
        prerequisites: this.getPrerequisites(skill, user),
        projectIdeas: this.generateProjectIdeas(skill),
        learningPath: this.generateLearningPath(skill),
      }));

      // OPTIMIZATION: Enhance with database and AI in background (completely non-blocking)
      // Don't await - fire and forget
      setImmediate(() => {
        Promise.all([
          this.getDatabaseResources(prioritizedSkills)
            .then(dbResources => {
              // Update recommendations with database resources
              fastRecommendations.forEach(rec => {
                const matching = dbResources.filter(r => 
                  (r.relatedSkills || []).some(rs => 
                    rs.toLowerCase().includes(rec.skill.toLowerCase()) ||
                    rec.skill.toLowerCase().includes(rs.toLowerCase())
                  )
                );
                if (matching.length > 0) {
                  rec.resources = [
                    ...matching.map(r => ({
                      name: r.title,
                      platform: r.platform,
                      url: r.url,
                      type: 'Course',
                      cost: r.cost,
                      source: 'database',
                    })),
                    ...rec.resources,
                  ];
                }
              });
            })
            .catch(() => {}),
          this.enhanceWithAI(prioritizedSkills, user, job, fastRecommendations)
            .catch(() => {}),
        ]).catch(() => {});
      });

      // Return immediately - no async operations in critical path
      return {
        missingSkills: exactMissingSkills,
        prioritizedSkills,
        recommendations: fastRecommendations,
        semanticMatches: [],
        totalGaps: exactMissingSkills.length,
        message: exactMissingSkills.length === 0 
          ? 'You have all required skills! 🎉' 
          : `You're missing ${exactMissingSkills.length} key skill(s)`,
      };
    } catch (error) {
      console.error('Skill Gap Analysis Agent Error:', error);
      // Fallback to simple exact matching
      return this.fallbackAnalysis(user, job);
    }
  }

  /**
   * Generate fast template recommendations (no AI wait)
   * 
   * @param {Array} prioritizedSkills - Prioritized skills
   * @param {Array} databaseResources - Database resources
   * @param {Object} user - User profile
   * @returns {Array} Fast template recommendations
   */
  generateFastRecommendations(prioritizedSkills, databaseResources, user) {
    return prioritizedSkills.map(({ skill, priority, isCore }) => {
      const dbResources = databaseResources.filter(r => 
        (r.relatedSkills || []).some(rs => 
          rs.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(rs.toLowerCase())
        )
      );

      return {
        skill,
        priority,
        isCore,
        resources: [
          ...dbResources.map(r => ({
            name: r.title,
            platform: r.platform,
            url: r.url,
            type: 'Course',
            cost: r.cost,
            source: 'database',
          })),
          ...this.getFallbackResources(skill).map(r => ({
            ...r,
            source: 'template',
          })),
        ],
        estimatedTime: this.estimateLearningTime(skill),
        prerequisites: this.getPrerequisites(skill, user),
        projectIdeas: this.generateProjectIdeas(skill),
        learningPath: this.generateLearningPath(skill),
      };
    });
  }

  /**
   * Enhance recommendations with AI in background
   * OPTIMIZED: Aggressive timeout (1 second) - skip if too slow
   * 
   * @param {Array} prioritizedSkills - Prioritized skills
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @param {Array} fastRecommendations - Fast template recommendations
   */
  async enhanceWithAI(prioritizedSkills, user, job, fastRecommendations) {
    try {
      // OPTIMIZATION: Aggressive timeout (1 second) - if AI is slow, skip it
      const aiRecommendations = await Promise.race([
        this.generateAILearningPaths(prioritizedSkills.slice(0, 2), user, job), // Only top 2 skills
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 1000))
      ]).catch(() => []);

      // Update recommendations with AI data (if available)
      if (aiRecommendations.length > 0) {
        aiRecommendations.forEach(aiRec => {
          const recIndex = fastRecommendations.findIndex(r => 
            r.skill.toLowerCase() === aiRec.skill.toLowerCase()
          );
          if (recIndex !== -1) {
            fastRecommendations[recIndex] = {
              ...fastRecommendations[recIndex],
              resources: [
                ...fastRecommendations[recIndex].resources,
                ...(aiRec.resources || []).map(r => ({
                  ...r,
                  source: 'ai-generated',
                })),
              ],
              estimatedTime: aiRec.estimatedTime || fastRecommendations[recIndex].estimatedTime,
              prerequisites: aiRec.prerequisites.length > 0 ? aiRec.prerequisites : fastRecommendations[recIndex].prerequisites,
              projectIdeas: aiRec.projectIdeas.length > 0 ? aiRec.projectIdeas : fastRecommendations[recIndex].projectIdeas,
              learningPath: aiRec.learningPath.length > 0 ? aiRec.learningPath : fastRecommendations[recIndex].learningPath,
            };
          }
        });
      }
    } catch (error) {
      // Silently fail - template recommendations are sufficient
    }
  }

  /**
   * Get prerequisites for a skill based on user's current skills
   * 
   * @param {String} skill - Skill name
   * @param {Object} user - User profile
   * @returns {Array} Prerequisites
   */
  getPrerequisites(skill, user) {
    const skillLower = skill.toLowerCase();
    const userSkills = (user.skills || []).map(s => s.toLowerCase());
    
    const prerequisites = [];
    
    if (skillLower.includes('react') || skillLower.includes('vue') || skillLower.includes('angular')) {
      if (!userSkills.some(s => s.includes('javascript'))) {
        prerequisites.push('JavaScript');
      }
      if (!userSkills.some(s => s.includes('html'))) {
        prerequisites.push('HTML');
      }
      if (!userSkills.some(s => s.includes('css'))) {
        prerequisites.push('CSS');
      }
    }
    
    if (skillLower.includes('node') || skillLower.includes('express')) {
      if (!userSkills.some(s => s.includes('javascript'))) {
        prerequisites.push('JavaScript');
      }
    }
    
    if (skillLower.includes('machine learning') || skillLower.includes('ml')) {
      if (!userSkills.some(s => s.includes('python'))) {
        prerequisites.push('Python');
      }
      prerequisites.push('Mathematics (Linear Algebra, Statistics)');
    }
    
    return prerequisites.length > 0 ? prerequisites : ['Basic programming knowledge'];
  }

  /**
   * Prioritize missing skills based on job requirements and user goals
   * OPTIMIZED: Synchronous (no async needed)
   * 
   * @param {Array} missingSkills - List of missing skills
   * @param {Object} job - Job details
   * @param {Object} user - User profile
   * @returns {Array} Prioritized skills with priority scores
   */
  prioritizeSkills(missingSkills, job, user) {
    if (missingSkills.length === 0) return [];

    // Priority factors:
    // 1. Core skills (mentioned first in job requirements) - higher priority
    // 2. Skills aligned with user's preferred track - higher priority
    // 3. Skills mentioned in job title/description - higher priority

    const jobTitleLower = (job.title || '').toLowerCase();
    const jobDescriptionLower = (job.description || '').toLowerCase();
    const userTrackLower = (user.preferredTrack || '').toLowerCase();

    return missingSkills.map((skill, index) => {
      let priority = 100 - (index * 5); // Base priority decreases with position

      // Boost if skill is in job title
      if (jobTitleLower.includes(skill.toLowerCase())) {
        priority += 30;
      }

      // Boost if skill is in job description
      if (jobDescriptionLower.includes(skill.toLowerCase())) {
        priority += 20;
      }

      // Boost if skill aligns with user's track
      if (userTrackLower && skill.toLowerCase().includes(userTrackLower) || 
          userTrackLower.includes(skill.toLowerCase())) {
        priority += 25;
      }

      // Boost for core/fundamental skills
      const coreSkills = ['javascript', 'python', 'html', 'css', 'sql', 'git'];
      if (coreSkills.some(cs => skill.toLowerCase().includes(cs))) {
        priority += 15;
      }

      return {
        skill,
        priority: Math.min(priority, 100),
        isCore: coreSkills.some(cs => skill.toLowerCase().includes(cs)),
        isInTitle: jobTitleLower.includes(skill.toLowerCase()),
        alignsWithTrack: userTrackLower && (
          skill.toLowerCase().includes(userTrackLower) || 
          userTrackLower.includes(skill.toLowerCase())
        ),
      };
    }).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get personalized learning recommendations for missing skills
   * DEPRECATED: Use analyzeSkillGaps which now includes fast recommendations
   * Kept for backward compatibility
   * 
   * @param {Array} prioritizedSkills - Prioritized missing skills
   * @param {Object} user - User profile
   * @param {Object} job - Job details (optional)
   * @returns {Array} Learning recommendations with resources and paths
   */
  async getLearningRecommendations(prioritizedSkills, user, job = null) {
    if (prioritizedSkills.length === 0) return [];

    try {
      // OPTIMIZATION: Fast template-based recommendations
      const databaseResources = await this.getDatabaseResources(prioritizedSkills).catch(() => []);
      return this.generateFastRecommendations(prioritizedSkills, databaseResources, user);
    } catch (error) {
      console.error('Learning Recommendations Error:', error);
      // Fallback to basic recommendations
      return prioritizedSkills.map(({ skill, priority }) => ({
        skill,
        priority,
        resources: this.getFallbackResources(skill),
        estimatedTime: '2-4 weeks',
        projectIdeas: [`Build a project using ${skill}`],
      }));
    }
  }

  /**
   * Get learning resources from database matching missing skills
   * OPTIMIZED: Ultra-fast query with aggressive timeout (200ms)
   * 
   * @param {Array} prioritizedSkills - Prioritized skills
   * @returns {Array} Database resources
   */
  async getDatabaseResources(prioritizedSkills) {
    try {
      const skillNames = prioritizedSkills.slice(0, 3).map(ps => ps.skill); // OPTIMIZATION: Only top 3 skills
      
      // OPTIMIZATION: Aggressive timeout (200ms) - if DB is slow, skip it
      const queryPromise = Resource.find({
        $or: skillNames.map(skill => ({
          relatedSkills: { $regex: new RegExp(skill, 'i') }
        }))
      })
      .select('title platform cost relatedSkills url')
      .lean()
      .limit(10); // OPTIMIZATION: Reduced to 10

      const resources = await Promise.race([
        queryPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 200))
      ]);

      return resources;
    } catch (error) {
      // Silently fail - fallback resources will be used
      return [];
    }
  }

  /**
   * Generate AI-powered learning paths for missing skills
   * OPTIMIZED: Reduced prompt size, faster generation
   * 
   * @param {Array} prioritizedSkills - Prioritized skills (max 3)
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Array} AI-generated learning recommendations
   */
  async generateAILearningPaths(prioritizedSkills, user, job) {
    try {
      const skillsList = prioritizedSkills.map(ps => ps.skill).join(', ');
      
      // OPTIMIZATION: Shortened prompt (removed long few-shot examples)
      const prompt = `Generate learning paths for missing skills.

User: ${(user.skills || []).slice(0, 5).join(', ') || 'None'}, ${user.experienceLevel || 'Fresher'}, ${user.preferredTrack || 'General'}
Job: ${job ? `${job.title}` : 'General'}
Missing Skills: ${skillsList}

For each skill, provide JSON:
{
  "recommendations": [
    {
      "skill": "SkillName",
      "resources": [
        {"name": "Resource", "type": "Documentation|Video Course|Tutorial", "url": "https://example.com"}
      ],
      "estimatedTime": "2-3 weeks",
      "prerequisites": ["Prereq1"],
      "projectIdeas": ["Project 1", "Project 2"],
      "learningPath": ["Week 1: Milestone", "Week 2: Milestone"]
    }
  ]
}

Return ONLY valid JSON.`;

      // OPTIMIZATION: Ultra-reduced maxTokens for fastest generation
      const response = await aiService.generateStructuredJSON(prompt, {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                skill: { type: 'string' },
                resources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      url: { type: 'string' },
                    },
                    required: ['name', 'type', 'url'],
                  },
                },
                estimatedTime: { type: 'string' },
                prerequisites: { type: 'array', items: { type: 'string' } },
                projectIdeas: { type: 'array', items: { type: 'string' } },
                learningPath: { type: 'array', items: { type: 'string' } },
              },
              required: ['skill', 'resources', 'estimatedTime', 'prerequisites', 'projectIdeas', 'learningPath'],
            },
          },
        },
        required: ['recommendations'],
      }, {
        temperature: 0.6,
        maxTokens: 500, // OPTIMIZATION: Reduced to 500 for ultra-fast generation
      });
      
      return response.recommendations || [];
    } catch (error) {
      console.error('AI Learning Paths Error:', error);
      return [];
    }
  }

  /**
   * Estimate learning time for a skill based on complexity
   * 
   * @param {String} skill - Skill name
   * @returns {String} Estimated time
   */
  estimateLearningTime(skill) {
    const skillLower = skill.toLowerCase();
    
    // Core/fundamental skills - longer time
    if (skillLower.includes('javascript') || skillLower.includes('python') || 
        skillLower.includes('react') || skillLower.includes('node')) {
      return '4-6 weeks';
    }
    
    // Framework/library skills - medium time
    if (skillLower.includes('redux') || skillLower.includes('typescript') ||
        skillLower.includes('express') || skillLower.includes('vue')) {
      return '2-3 weeks';
    }
    
    // Tool/specific skills - shorter time
    if (skillLower.includes('git') || skillLower.includes('docker') ||
        skillLower.includes('figma') || skillLower.includes('jest')) {
      return '1-2 weeks';
    }
    
    return '2-4 weeks'; // Default
  }

  /**
   * Generate project ideas for a skill
   * 
   * @param {String} skill - Skill name
   * @returns {Array} Project ideas
   */
  generateProjectIdeas(skill) {
    const skillLower = skill.toLowerCase();
    
    if (skillLower.includes('react') || skillLower.includes('frontend')) {
      return [
        `Build a ${skill} todo app with state management`,
        `Create a portfolio website using ${skill}`,
        `Develop a weather app with ${skill}`
      ];
    }
    
    if (skillLower.includes('node') || skillLower.includes('backend')) {
      return [
        `Build a REST API using ${skill}`,
        `Create a chat application with ${skill}`,
        `Develop a blog API with ${skill}`
      ];
    }
    
    if (skillLower.includes('python') || skillLower.includes('data')) {
      return [
        `Build a data analysis script with ${skill}`,
        `Create a web scraper using ${skill}`,
        `Develop a machine learning model with ${skill}`
      ];
    }
    
    return [
      `Build a project using ${skill}`,
      `Create a tutorial app with ${skill}`,
      `Develop a portfolio piece showcasing ${skill}`
    ];
  }

  /**
   * Generate a learning path for a skill
   * 
   * @param {String} skill - Skill name
   * @returns {Array} Learning path steps
   */
  generateLearningPath(skill) {
    return [
      `Week 1: Learn ${skill} fundamentals and basics`,
      `Week 2: Practice with small exercises and tutorials`,
      `Week 3: Build a small project using ${skill}`,
      `Week 4: Refine and add to portfolio`
    ];
  }

  /**
   * Get fallback resources when AI/database fails
   * 
   * @param {String} skill - Skill name
   * @returns {Array} Fallback resources
   */
  getFallbackResources(skill) {
    const skillLower = skill.toLowerCase();
    const resourceMap = {
      'react': { name: 'React Official Docs', url: 'https://react.dev', type: 'Documentation' },
      'typescript': { name: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/', type: 'Documentation' },
      'javascript': { name: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', type: 'Documentation' },
      'python': { name: 'Python Tutorial', url: 'https://docs.python.org/3/tutorial/', type: 'Documentation' },
      'node': { name: 'Node.js Guide', url: 'https://nodejs.org/en/docs/', type: 'Documentation' },
    };

    for (const [key, resource] of Object.entries(resourceMap)) {
      if (skillLower.includes(key)) {
        return [resource];
      }
    }

    return [{
      name: `${skill} Tutorial`,
      type: 'Tutorial',
      url: '#',
    }];
  }

  /**
   * Fallback analysis when main analysis fails
   * 
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Object} Basic skill gap analysis
   */
  fallbackAnalysis(user, job) {
    const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
    const jobRequiredSkills = (job.requiredSkills || []).map(s => s.toLowerCase().trim());

    const missingSkills = jobRequiredSkills.filter(
      jobSkill => !userSkills.some(userSkill => userSkill === jobSkill)
    );

    return {
      missingSkills,
      prioritizedSkills: missingSkills.map(skill => ({ skill, priority: 50 })),
      recommendations: missingSkills.map(skill => ({
        skill,
        priority: 50,
        resources: this.getFallbackResources(skill),
        estimatedTime: '2-4 weeks',
        projectIdeas: [`Build a project using ${skill}`],
      })),
      totalGaps: missingSkills.length,
      message: missingSkills.length === 0 
        ? 'You have all required skills! 🎉' 
        : `You're missing ${missingSkills.length} key skill(s)`,
    };
  }
}

module.exports = new SkillGapAnalysisAgent();

