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
      
      // OPTIMIZATION: Use .select() and .lean() for faster queries
      const resources = await Resource.find({
        $or: skillNames.map(skill => ({
          relatedSkills: { $regex: new RegExp(skill, 'i') }
        }))
      })
      .select('title platform cost relatedSkills url')
      .lean()
      .limit(20);

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
      
      // OPTIMIZATION: Few-shot examples for better learning path generation
      const prompt = `You are a career mentor helping a user learn new skills for job opportunities.

FEW-SHOT EXAMPLES (Learn from these correct learning path generations):

Example 1 - User Profile:
- Current Skills: JavaScript, HTML, CSS
- Experience Level: Junior
- Preferred Track: Frontend Development
- Missing Skill: React

Correct Learning Path:
{
  "skill": "React",
  "resources": [
    {"name": "React Official Documentation", "type": "Documentation", "url": "https://react.dev"},
    {"name": "React - The Complete Guide", "type": "Video Course", "url": "https://udemy.com/react-complete-guide"},
    {"name": "React Tutorial on freeCodeCamp", "type": "Interactive Tutorial", "url": "https://freecodecamp.org"}
  ],
  "estimatedTime": "3-4 weeks",
  "prerequisites": ["JavaScript", "HTML", "CSS"],
  "projectIdeas": [
    "Build a todo app with React hooks and state management",
    "Create a weather app using React and a weather API",
    "Develop a portfolio website using React components"
  ],
  "learningPath": [
    "Week 1: Learn React fundamentals (components, JSX, props)",
    "Week 2: Master React hooks (useState, useEffect, useContext)",
    "Week 3: Build a small project (todo app or calculator)",
    "Week 4: Add advanced features (routing, state management)"
  ]
}

Example 2 - User Profile:
- Current Skills: Python, SQL
- Experience Level: Fresher
- Preferred Track: Data Science
- Missing Skill: Machine Learning

Correct Learning Path:
{
  "skill": "Machine Learning",
  "resources": [
    {"name": "Machine Learning Course by Andrew Ng", "type": "Video Course", "url": "https://coursera.org/ml"},
    {"name": "Scikit-learn Documentation", "type": "Documentation", "url": "https://scikit-learn.org"},
    {"name": "Kaggle Learn - Machine Learning", "type": "Interactive Tutorial", "url": "https://kaggle.com/learn"}
  ],
  "estimatedTime": "6-8 weeks",
  "prerequisites": ["Python", "Mathematics (Linear Algebra, Statistics)"],
  "projectIdeas": [
    "Build a house price prediction model using linear regression",
    "Create a spam email classifier using Naive Bayes",
    "Develop a recommendation system for movies or products"
  ],
  "learningPath": [
    "Week 1-2: Learn ML fundamentals and mathematics basics",
    "Week 3-4: Study supervised learning (regression, classification)",
    "Week 5-6: Practice with real datasets on Kaggle",
    "Week 7-8: Build a complete ML project from scratch"
  ]
}

User Profile:
- Current Skills: ${(user.skills || []).join(', ') || 'None'}
- Experience Level: ${user.experienceLevel || 'Fresher'}
- Preferred Track: ${user.preferredTrack || 'Not specified'}
- Education: ${user.educationLevel || 'Not specified'}

Target Job: ${job ? `${job.title} at ${job.company}` : 'General career development'}
Missing Skills: ${skillsList}

For each missing skill, provide:
1. Best learning resources (courses, tutorials, documentation) with URLs (3-5 resources)
2. Estimated learning time (realistic, e.g., "2-3 weeks", "1 month", "6-8 weeks")
3. Prerequisites (what they should know first - be specific)
4. Project ideas to practice (2-3 specific, actionable projects)
5. Learning path (step-by-step approach with weekly milestones)

Guidelines:
- Make learning time realistic based on user's experience level (${user.experienceLevel || 'Fresher'})
- Provide actual, accessible resources (official docs, popular courses, free tutorials)
- Prerequisites should be specific skills, not vague concepts
- Project ideas should be achievable and portfolio-worthy
- Learning path should progress from basics to advanced, with clear milestones
- Align recommendations with ${user.preferredTrack || 'general'} track
- Focus on practical, actionable advice aligned with SDG 8 (decent work and economic growth) goals

Return JSON:
{
  "recommendations": [
    {
      "skill": "SkillName",
      "resources": [
        {"name": "Resource Name", "type": "Documentation|Video Course|Interactive Tutorial|Book", "url": "https://example.com"}
      ],
      "estimatedTime": "2-3 weeks",
      "prerequisites": ["Prerequisite1", "Prerequisite2"],
      "projectIdeas": [
        "Specific project idea 1",
        "Specific project idea 2",
        "Specific project idea 3"
      ],
      "learningPath": [
        "Week 1: Specific milestone",
        "Week 2: Specific milestone",
        "Week 3: Specific milestone"
      ]
    }
  ]
}

Return ONLY valid JSON, no markdown, no code blocks.`;

      // OPTIMIZATION: Schema validation and task-specific temperature/tokens
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
        temperature: 0.6, // OPTIMIZATION: Moderate temperature for balanced learning recommendations
        maxTokens: 1500,   // OPTIMIZATION: Sufficient for comprehensive learning paths
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

