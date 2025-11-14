const aiService = require('./aiService');
const Roadmap = require('../models/Roadmap');

class RoadmapService {
  async generateCareerRoadmap(userId, targetRole, timeframe = 6, availableHours = 10) {
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const prompt = `Create a detailed ${timeframe}-month career roadmap for transitioning to ${targetRole}.

Current Profile:
- Skills: ${user.skills.join(', ') || 'None listed'}
- Experience Level: ${user.experienceLevel}
- Preferred Track: ${user.preferredTrack}
- Education: ${user.educationLevel}
- Career Interests: ${user.careerInterests.join(', ') || 'None'}

Target Role: ${targetRole}
Timeframe: ${timeframe} months
Available Learning Time: ${availableHours} hours per week

Generate a comprehensive, actionable roadmap with:

1. Monthly phases (${timeframe} phases total)
2. Each phase should include:
   - Learning objectives (2-3 specific goals)
   - Specific skills/technologies to learn
   - Projects to build (with descriptions)
   - Milestones to achieve
   - Estimated time commitment

3. Final phase should include:
   - When to start applying
   - Portfolio preparation
   - Interview preparation tips

Return JSON:
{
  "targetRole": "${targetRole}",
  "timeframe": ${timeframe},
  "phases": [
    {
      "month": 1,
      "title": "Phase 1: Foundation",
      "objectives": ["obj1", "obj2"],
      "skillsToLearn": ["skill1", "skill2"],
      "projects": [
        {
          "name": "Project Name",
          "description": "What to build",
          "technologies": ["tech1", "tech2"],
          "difficulty": "Beginner/Intermediate/Advanced"
        }
      ],
      "milestones": ["milestone1", "milestone2"],
      "estimatedHours": 40
    }
  ],
  "applicationTimeline": "Start applying in month ${timeframe - 1}",
  "portfolioTips": ["tip1", "tip2"],
  "interviewPrep": ["prep1", "prep2"]
}`;

    try {
      const roadmapData = await aiService.generateStructuredJSON(prompt);
      
      // Validate phases
      if (!roadmapData.phases || !Array.isArray(roadmapData.phases)) {
        throw new Error('Invalid roadmap structure');
      }

      // Save roadmap to database
      const roadmap = await Roadmap.findOneAndUpdate(
        { userId, targetRole },
        {
          userId,
          targetRole,
          timeframe,
          phases: roadmapData.phases,
          applicationTimeline: roadmapData.applicationTimeline || `Start applying in month ${timeframe - 1}`,
          portfolioTips: roadmapData.portfolioTips || [],
          interviewPrep: roadmapData.interviewPrep || [],
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return {
        roadmapId: roadmap._id,
        ...roadmapData,
      };
    } catch (error) {
      console.error('Roadmap Generation Error:', error);
      throw new Error(`Failed to generate roadmap: ${error.message}`);
    }
  }

  async getUserRoadmaps(userId) {
    return await Roadmap.find({ userId }).sort({ generatedAt: -1 });
  }

  async getRoadmapById(roadmapId, userId) {
    const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
    if (!roadmap) {
      throw new Error('Roadmap not found');
    }
    return roadmap;
  }

  async deleteRoadmap(roadmapId, userId) {
    const roadmap = await Roadmap.findOneAndDelete({ _id: roadmapId, userId });
    if (!roadmap) {
      throw new Error('Roadmap not found');
    }
    return roadmap;
  }
}

module.exports = new RoadmapService();

