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
   * Uses both exact matching and semantic similarity for comprehensive analysis
   * 
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Object} Skill gap analysis with missing skills and recommendations
   */
  async analyzeSkillGaps(user, job) {
    try {
      await this.initialize();

      const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
      const jobRequiredSkills = (job.requiredSkills || []).map(s => s.toLowerCase().trim());

      // Step 1: Exact matching to find missing skills
      const exactMissingSkills = jobRequiredSkills.filter(
        jobSkill => !userSkills.some(
          userSkill => userSkill === jobSkill
        )
      );

      // Step 2: Semantic matching using ChromaDB to find similar skills user might have
      let semanticMatches = [];
      if (chromaService.collection && exactMissingSkills.length > 0) {
        try {
          for (const missingSkill of exactMissingSkills.slice(0, 10)) {
            const similar = await chromaService.searchSimilarSkills(missingSkill, 3);
            semanticMatches.push(...similar.map(s => ({
              missingSkill,
              similarSkill: s.skill,
              similarity: 1 - s.distance,
            })));
          }
        } catch (error) {
          console.warn('ChromaDB semantic search warning:', error.message);
        }
      }

      // Step 3: Check if user has semantically similar skills
      const userHasSimilar = semanticMatches
        .filter(match => match.similarity > 0.7)
        .map(match => {
          const userHas = userSkills.some(us => 
            us.includes(match.similarSkill.toLowerCase()) || 
            match.similarSkill.toLowerCase().includes(us)
          );
          return { ...match, userHas };
        })
        .filter(m => m.userHas);

      // Step 4: Final missing skills (exact missing minus semantically similar)
      const trulyMissingSkills = exactMissingSkills.filter(missing => {
        const hasSimilar = userHasSimilar.some(uh => 
          uh.missingSkill.toLowerCase() === missing.toLowerCase()
        );
        return !hasSimilar;
      });

      // Step 5: Prioritize skills based on job requirements
      const prioritizedSkills = await this.prioritizeSkills(trulyMissingSkills, job, user);

      // Step 6: Get learning recommendations
      const recommendations = await this.getLearningRecommendations(
        prioritizedSkills,
        user,
        job
      );

      return {
        missingSkills: trulyMissingSkills,
        prioritizedSkills,
        recommendations,
        semanticMatches: userHasSimilar,
        totalGaps: trulyMissingSkills.length,
        message: trulyMissingSkills.length === 0 
          ? 'You have all required skills! 🎉' 
          : `You're missing ${trulyMissingSkills.length} key skill(s)`,
      };
    } catch (error) {
      console.error('Skill Gap Analysis Agent Error:', error);
      // Fallback to simple exact matching
      return this.fallbackAnalysis(user, job);
    }
  }

  /**
   * Prioritize missing skills based on job requirements and user goals
   * 
   * @param {Array} missingSkills - List of missing skills
   * @param {Object} job - Job details
   * @param {Object} user - User profile
   * @returns {Array} Prioritized skills with priority scores
   */
  async prioritizeSkills(missingSkills, job, user) {
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
   * Combines database resources with AI-generated suggestions
   * 
   * @param {Array} prioritizedSkills - Prioritized missing skills
   * @param {Object} user - User profile
   * @param {Object} job - Job details (optional)
   * @returns {Array} Learning recommendations with resources and paths
   */
  async getLearningRecommendations(prioritizedSkills, user, job = null) {
    if (prioritizedSkills.length === 0) return [];

    try {
      // Step 1: Get resources from database
      const databaseResources = await this.getDatabaseResources(prioritizedSkills);

      // Step 2: Use AI to generate comprehensive learning paths
      const aiRecommendations = await this.generateAILearningPaths(
        prioritizedSkills,
        user,
        job
      );

      // Step 3: Combine and enhance recommendations
      return prioritizedSkills.map(({ skill, priority, isCore }) => {
        const dbResources = databaseResources.filter(r => 
          r.relatedSkills.some(rs => 
            rs.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(rs.toLowerCase())
          )
        );

        const aiRec = aiRecommendations.find(ar => 
          ar.skill.toLowerCase() === skill.toLowerCase()
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
            ...(aiRec?.resources || []).map(r => ({
              ...r,
              source: 'ai-generated',
            })),
          ],
          estimatedTime: aiRec?.estimatedTime || this.estimateLearningTime(skill),
          prerequisites: aiRec?.prerequisites || [],
          projectIdeas: aiRec?.projectIdeas || this.generateProjectIdeas(skill),
          learningPath: aiRec?.learningPath || this.generateLearningPath(skill),
        };
      });
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
   * 
   * @param {Array} prioritizedSkills - Prioritized skills
   * @returns {Array} Database resources
   */
  async getDatabaseResources(prioritizedSkills) {
    try {
      const skillNames = prioritizedSkills.map(ps => ps.skill);
      
      // Use regex for case-insensitive matching
      const resources = await Resource.find({
        $or: skillNames.map(skill => ({
          relatedSkills: { $regex: new RegExp(skill, 'i') }
        }))
      }).limit(20);

      return resources;
    } catch (error) {
      console.error('Database Resources Error:', error);
      return [];
    }
  }

  /**
   * Generate AI-powered learning paths for missing skills
   * 
   * @param {Array} prioritizedSkills - Prioritized skills
   * @param {Object} user - User profile
   * @param {Object} job - Job details
   * @returns {Array} AI-generated learning recommendations
   */
  async generateAILearningPaths(prioritizedSkills, user, job) {
    try {
      const skillsList = prioritizedSkills.map(ps => ps.skill).join(', ');
      
      const prompt = `You are a career mentor helping a user learn new skills for job opportunities.

User Profile:
- Current Skills: ${(user.skills || []).join(', ') || 'None'}
- Experience Level: ${user.experienceLevel || 'Fresher'}
- Preferred Track: ${user.preferredTrack || 'Not specified'}
- Education: ${user.educationLevel || 'Not specified'}

Target Job: ${job ? `${job.title} at ${job.company}` : 'General career development'}
Missing Skills: ${skillsList}

For each missing skill, provide:
1. Best learning resources (courses, tutorials, documentation) with URLs
2. Estimated learning time (realistic, e.g., "2-3 weeks", "1 month")
3. Prerequisites (what they should know first)
4. Project ideas to practice (2-3 specific projects)
5. Learning path (step-by-step approach)

Return JSON:
{
  "recommendations": [
    {
      "skill": "TypeScript",
      "resources": [
        {"name": "TypeScript Handbook", "type": "Documentation", "url": "https://www.typescriptlang.org/docs/"},
        {"name": "TypeScript Course", "type": "Video Course", "url": "https://example.com"}
      ],
      "estimatedTime": "2-3 weeks",
      "prerequisites": ["JavaScript"],
      "projectIdeas": [
        "Convert existing JavaScript project to TypeScript",
        "Build a TypeScript-based calculator app"
      ],
      "learningPath": [
        "Week 1: Learn basic types and interfaces",
        "Week 2: Practice with functions and classes",
        "Week 3: Build a project"
      ]
    }
  ]
}

Focus on practical, actionable advice aligned with SDG 8 (decent work and economic growth) goals.`;

      const response = await aiService.generateStructuredJSON(prompt);
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

