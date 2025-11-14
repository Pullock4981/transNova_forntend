const aiService = require('../services/aiService');
const chromaService = require('../services/chromaService');
const User = require('../models/User');
const Job = require('../models/Job');
const Resource = require('../models/Resource');

/**
 * Career Mentor Agent (CareerBot)
 * 
 * Purpose: Provides conversational AI mentorship and career guidance
 *          Answers career-related questions with context-aware responses
 * 
 * Responsibilities:
 * - Answers user questions about career development
 * - Provides personalized advice based on user profile
 * - Recommends skills to learn and job opportunities
 * - Suggests learning resources from database
 * - Offers career planning guidance aligned with SDG 8 goals
 * - Uses ChromaDB for semantic search of jobs and resources
 * 
 * Usage:
 *   const agent = require('./agents/careerMentorAgent');
 *   await agent.initialize();
 *   const response = await agent.getContextualResponse(userId, userMessage);
 */
class CareerMentorAgent {
  /**
   * Initialize the agent and ChromaDB connection
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
  }

  /**
   * Get contextual response to user's career question
   * Uses AI with user profile, relevant jobs, and resources as context
   * 
   * @param {String} userId - User's MongoDB _id
   * @param {String} userMessage - User's question/message
   * @returns {Object} Response with answer and metadata
   */
  async getContextualResponse(userId, userMessage) {
    try {
      await this.initialize();

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user context
      const userContext = {
        skills: user.skills || [],
        experienceLevel: user.experienceLevel,
        preferredTrack: user.preferredTrack,
        careerInterests: user.careerInterests || [],
        educationLevel: user.educationLevel,
      };

      // Get relevant jobs using semantic search if ChromaDB available
      let relevantJobs = [];
      let relevantResources = [];

      try {
        // Try semantic search first
        if (chromaService.collection && userContext.skills.length > 0) {
          const userSkillsText = userContext.skills.join(' ');
          const jobResults = await chromaService.collection.query({
            queryTexts: [userSkillsText],
            nResults: 5,
            where: { type: 'job' },
          });

          if (jobResults.metadatas && jobResults.metadatas[0]) {
            const jobIds = jobResults.metadatas[0]
              .map(meta => meta.jobId)
              .filter(Boolean);
            relevantJobs = await Job.find({ _id: { $in: jobIds } }).limit(5);
          }
        }

        // Fallback to exact matching
        if (relevantJobs.length === 0) {
          relevantJobs = await Job.find({
            $or: [
              { track: user.preferredTrack },
              { requiredSkills: { $in: user.skills } },
            ],
          }).limit(5);
        }

        // Get relevant resources
        relevantResources = await Resource.find({
          relatedSkills: { $in: user.skills },
        }).limit(5);
      } catch (error) {
        console.error('Error fetching context:', error);
      }

      // Build comprehensive prompt
      const prompt = `You are CareerBot, a friendly and helpful AI career mentor for youth seeking employment opportunities aligned with SDG 8 (Decent Work and Economic Growth).

Your role:
- Help users understand their career path
- Recommend skills to learn based on their profile
- Suggest job opportunities that match their skills
- Provide guidance on career development
- Be encouraging and supportive
- Give actionable, specific advice
- Always clearly indicate when you're suggesting, not guaranteeing outcomes. Use phrases like "I suggest", "I recommend", "you might consider" rather than definitive statements

User Profile:
- Skills: ${userContext.skills.join(', ') || 'None listed'}
- Experience Level: ${userContext.experienceLevel || 'Fresher'}
- Preferred Track: ${userContext.preferredTrack || 'Not specified'}
- Education: ${userContext.educationLevel || 'Not specified'}
- Career Interests: ${userContext.careerInterests.join(', ') || 'None'}

Available Job Opportunities (${relevantJobs.length}):
${relevantJobs.map(j => `- ${j.title} at ${j.company} (${j.jobType}, ${j.experienceLevel}) - Requires: ${(j.requiredSkills || []).slice(0, 3).join(', ')}`).join('\n') || 'None available'}

Available Learning Resources (${relevantResources.length}):
${relevantResources.map(r => `- ${r.title} on ${r.platform} (${r.cost}) - Covers: ${(r.relatedSkills || []).slice(0, 3).join(', ')}`).join('\n') || 'None available'}

Guidelines:
- Be concise but helpful (2-4 sentences for simple questions, more for complex ones)
- Always suggest actionable steps
- Reference specific skills, jobs, or resources when relevant
- If asked about skills, reference the user's current skills and suggest what to learn next
- If asked about jobs, mention relevant opportunities from the list above
- If asked "which roles fit my skills?", analyze their skills and suggest matching roles
- If asked "what should I learn next?", suggest skills based on their track and interests
- If asked "how to improve chances of getting internship?", provide practical tips
- Be honest about limitations and always clearly indicate suggestions, not guarantees. End responses with a brief note that these are recommendations and individual results may vary
- Encourage continuous learning and growth
- Use a friendly, encouraging, and professional tone
- Align advice with SDG 8 goals (decent work and economic growth)

User Question: "${userMessage}"

Provide a helpful, personalized response that directly addresses their question.`;

      try {
        // Use AI service to generate response
        const aiResponse = await aiService.generateContent(prompt, {
          temperature: 0.7,
          maxTokens: 500,
        });

        return {
          response: aiResponse,
          timestamp: new Date(),
          contextUsed: {
            jobsCount: relevantJobs.length,
            resourcesCount: relevantResources.length,
            userSkillsCount: userContext.skills.length,
          },
          isAI: true,
        };
      } catch (error) {
        console.error('AI Response Generation Error:', error);
        // Fallback to rule-based response
        return {
          response: this.getFallbackResponse(userMessage, userContext, relevantJobs, relevantResources),
          timestamp: new Date(),
          contextUsed: {
            jobsCount: relevantJobs.length,
            resourcesCount: relevantResources.length,
            userSkillsCount: userContext.skills.length,
          },
          isAI: false,
        };
      }
    } catch (error) {
      console.error('Career Mentor Agent Error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Get fallback response when AI is unavailable
   * Uses rule-based logic to provide helpful responses
   * 
   * @param {String} message - User's message
   * @param {Object} userContext - User context
   * @param {Array} relevantJobs - Relevant jobs
   * @param {Array} relevantResources - Relevant resources
   * @returns {String} Fallback response
   */
  getFallbackResponse(message, userContext, relevantJobs, relevantResources) {
    const lowerMessage = message.toLowerCase();
    
    // Questions about skills/learning
    if (lowerMessage.includes('skill') || lowerMessage.includes('learn') || 
        lowerMessage.includes('what should i learn')) {
      const currentSkills = userContext.skills.length > 0 
        ? userContext.skills.join(', ') 
        : 'various areas';
      const track = userContext.preferredTrack || 'your field';
      
      return `Based on your profile, you have skills in ${currentSkills}. To advance in ${track}, I suggest focusing on technologies that are in high demand. Check the job requirements in your dashboard to see which skills are most needed. The learning resources section also has great recommendations tailored to your track!`;
    }
    
    // Questions about roles/jobs
    if (lowerMessage.includes('role') || lowerMessage.includes('which roles') ||
        lowerMessage.includes('what roles fit')) {
      const track = userContext.preferredTrack || 'your field';
      const skills = userContext.skills.slice(0, 3).join(', ') || 'your current skills';
      
      return `Based on your skills (${skills}) and track (${track}), roles that might fit include: ${track} Developer, ${track} Specialist, or Junior ${track} positions. Check your job matches in the dashboard to see specific opportunities. Remember, these are suggestions - explore different roles to find your best fit!`;
    }
    
    // Questions about jobs/opportunities
    if (lowerMessage.includes('job') || lowerMessage.includes('opportunity') ||
        lowerMessage.includes('internship')) {
      if (relevantJobs.length > 0) {
        const jobList = relevantJobs.slice(0, 3).map(j => j.title).join(', ');
        return `Great question! With your ${userContext.experienceLevel} level experience, I found ${relevantJobs.length} relevant opportunities including: ${jobList}. Check your dashboard for detailed matches with percentage scores. You can also improve your profile to get better matches!`;
      }
      return `With your ${userContext.experienceLevel} level experience in ${userContext.preferredTrack || 'your field'}, there are opportunities available. Check the job listings in your dashboard. Consider updating your skills to increase your match percentage!`;
    }

    // Questions about roadmaps/planning
    if (lowerMessage.includes('roadmap') || lowerMessage.includes('plan') ||
        lowerMessage.includes('career path')) {
      return `I can help you create a personalized career roadmap! Use the "Generate Roadmap" feature in your profile. Specify your target role (e.g., "Frontend Developer") and timeframe (3-6 months), and I'll create a step-by-step plan with learning objectives, projects, and milestones. This is a suggested path - adjust it based on your progress!`;
    }

    // Questions about skill gaps
    if (lowerMessage.includes('gap') || lowerMessage.includes('missing') ||
        lowerMessage.includes('what am i missing')) {
      return `To identify skill gaps, check the job matches in your dashboard. Each job shows which skills you have (matched) and which ones you're missing. I can recommend specific learning resources to close those gaps. The skill gap analysis feature provides detailed recommendations with estimated learning time!`;
    }

    // Questions about improving chances
    if (lowerMessage.includes('improve') || lowerMessage.includes('chance') ||
        lowerMessage.includes('better match') || lowerMessage.includes('internship')) {
      return `To improve your chances: 1) Add more relevant skills to your profile, 2) Complete projects that showcase your abilities, 3) Use the skill gap analysis to learn missing skills, 4) Build a strong portfolio, and 5) Practice interview questions. Check your dashboard for personalized recommendations based on your profile!`;
    }
    
    // Default response
    return `I'm CareerBot, here to help with your career journey! I can assist with:
- Skill recommendations based on your profile
- Job opportunities that match your skills
- Learning resources to close skill gaps
- Career roadmaps and planning
- Interview and application tips

What would you like to know? Try asking: "Which roles fit my skills?" or "What should I learn next?"`;
  }
}

module.exports = new CareerMentorAgent();

