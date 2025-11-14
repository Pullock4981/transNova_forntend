const aiService = require('./aiService');
const chromaService = require('./chromaService');
const Resource = require('../models/Resource');

class SkillGapService {
  async analyzeSkillGaps(userSkills, jobRequiredSkills, userId) {
    const missingSkills = jobRequiredSkills.filter(
      jobSkill => !userSkills.some(
        userSkill => userSkill.toLowerCase() === jobSkill.toLowerCase()
      )
    );

    if (missingSkills.length === 0) {
      return {
        missingSkills: [],
        recommendations: [],
        message: 'You have all required skills!',
      };
    }

    // Use ChromaDB for semantic skill matching
    let semanticMatches = [];
    try {
      for (const missingSkill of missingSkills.slice(0, 5)) {
        const similar = await chromaService.searchSimilarSkills(missingSkill, 3);
        semanticMatches.push(...similar);
      }
    } catch (error) {
      console.error('ChromaDB search error:', error);
    }

    // Use AI to generate learning recommendations
    const prompt = `Analyze skill gaps and recommend learning resources.

User has these skills: ${userSkills.join(', ') || 'None'}

Job requires these skills: ${jobRequiredSkills.join(', ')}

Missing skills: ${missingSkills.join(', ')}

For each missing skill, recommend:
1. Best learning resources (courses, tutorials, platforms)
2. Estimated time to learn
3. Prerequisites
4. Project ideas to practice

Return JSON:
{
  "missingSkills": ["skill1", "skill2"],
  "recommendations": [
    {
      "skill": "TypeScript",
      "resources": [
        {"name": "TypeScript Handbook", "type": "Documentation", "url": "https://www.typescriptlang.org/docs/"},
        {"name": "TypeScript Course on YouTube", "type": "Video", "url": "..."}
      ],
      "estimatedTime": "2-3 weeks",
      "prerequisites": ["JavaScript"],
      "projectIdeas": ["Build a TypeScript calculator", "Convert JS project to TS"]
    }
  ],
  "priority": ["skill1", "skill2"]
}`;

    try {
      const analysis = await aiService.generateStructuredJSON(prompt);
      
      // Enhance with database resources
      const enhancedRecommendations = await this.enhanceWithDatabaseResources(
        missingSkills,
        userId
      );

      return {
        missingSkills: analysis.missingSkills || missingSkills,
        recommendations: analysis.recommendations || [],
        databaseResources: enhancedRecommendations,
        semanticMatches: semanticMatches.slice(0, 10),
        priority: analysis.priority || missingSkills,
      };
    } catch (error) {
      console.error('Skill Gap Analysis Error:', error);
      // Fallback
      return {
        missingSkills,
        recommendations: this.generateFallbackRecommendations(missingSkills),
        databaseResources: await this.enhanceWithDatabaseResources(missingSkills, userId),
        priority: missingSkills,
      };
    }
  }

  async enhanceWithDatabaseResources(missingSkills, userId) {
    try {
      const resources = await Resource.find({
        relatedSkills: { $in: missingSkills.map(s => new RegExp(s, 'i')) },
      }).limit(10);

      return resources.map(resource => ({
        title: resource.title,
        platform: resource.platform,
        url: resource.url,
        cost: resource.cost,
        relatedSkills: resource.relatedSkills,
      }));
    } catch (error) {
      return [];
    }
  }

  generateFallbackRecommendations(skills) {
    const platformMap = {
      'React': { name: 'React Official Docs', url: 'https://react.dev' },
      'TypeScript': { name: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/' },
      'Node.js': { name: 'Node.js Guide', url: 'https://nodejs.org/en/docs/' },
      'Python': { name: 'Python Tutorial', url: 'https://docs.python.org/3/tutorial/' },
      'JavaScript': { name: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
    };

    return skills.map(skill => ({
      skill,
      resources: platformMap[skill] ? [platformMap[skill]] : [
        { name: `${skill} Tutorial`, type: 'Tutorial', url: '#' }
      ],
      estimatedTime: '2-4 weeks',
      projectIdeas: [`Build a project using ${skill}`],
    }));
  }
}

module.exports = new SkillGapService();

