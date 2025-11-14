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
  constructor() {
    // OPTIMIZATION: In-memory conversation history storage
    // Key: userId, Value: Array of {role, content, timestamp}
    this.conversationHistory = new Map();
    this.MAX_HISTORY_LENGTH = 10; // Keep last 10 messages (5 exchanges)
    this.HISTORY_TTL = 30 * 60 * 1000; // 30 minutes TTL
    
    // Clean old conversations periodically
    setInterval(() => {
      this.cleanOldConversations();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean old conversation history
   */
  cleanOldConversations() {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, history] of this.conversationHistory.entries()) {
      // Remove conversations older than TTL
      const recentHistory = history.filter(msg => now - msg.timestamp < this.HISTORY_TTL);
      if (recentHistory.length === 0) {
        this.conversationHistory.delete(userId);
        cleaned++;
      } else if (recentHistory.length < history.length) {
        this.conversationHistory.set(userId, recentHistory);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired conversation histories`);
    }
  }

  /**
   * Get conversation history for a user
   * @param {String} userId - User ID
   * @returns {Array} Array of message objects
   */
  getConversationHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Add message to conversation history
   * @param {String} userId - User ID
   * @param {String} role - 'user' or 'assistant'
   * @param {String} content - Message content
   */
  addToHistory(userId, role, content) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    
    const history = this.conversationHistory.get(userId);
    history.push({
      role,
      content,
      timestamp: Date.now(),
    });
    
    // Keep only last MAX_HISTORY_LENGTH messages
    if (history.length > this.MAX_HISTORY_LENGTH) {
      history.shift(); // Remove oldest
    }
    
    this.conversationHistory.set(userId, history);
  }

  /**
   * Clear conversation history for a user
   * @param {String} userId - User ID
   */
  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }

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

      // OPTIMIZATION: Use .select() and .lean() for faster queries
      const user = await User.findById(userId)
        .select('skills experienceLevel preferredTrack careerInterests educationLevel')
        .lean();
      
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

      // OPTIMIZATION: Parallel fetching of jobs and resources
      let relevantJobs = [];
      let relevantResources = [];

      try {
        // Parallelize ChromaDB query and database queries
        const [jobResults, fallbackJobs, resources] = await Promise.all([
          // Try semantic search first
          chromaService.collection && userContext.skills.length > 0
            ? chromaService.collection.query({
                queryTexts: [userContext.skills.join(' ')],
                nResults: 5,
                where: { type: 'job' },
              }).catch(() => null)
            : Promise.resolve(null),
          // Fallback jobs query (always run in parallel)
          Job.find({
            $or: [
              { track: user.preferredTrack },
              { requiredSkills: { $in: user.skills } },
            ],
          })
          .select('title company jobType experienceLevel requiredSkills track')
          .lean()
          .limit(5)
          .catch(() => []),
          // Resources query
          Resource.find({
            relatedSkills: { $in: user.skills },
          })
          .select('title platform cost relatedSkills')
          .lean()
          .limit(5)
          .catch(() => []),
        ]);

        // OPTIMIZATION: Hybrid search - merge semantic and keyword results
        const semanticJobIds = new Set();
        if (jobResults && jobResults.metadatas && jobResults.metadatas[0]) {
          const ids = jobResults.metadatas[0]
            .map(meta => meta.jobId)
            .filter(Boolean);
          ids.forEach(id => semanticJobIds.add(id.toString()));
        }

        // Get semantic search jobs
        let semanticJobs = [];
        if (semanticJobIds.size > 0) {
          semanticJobs = await Job.find({ _id: { $in: Array.from(semanticJobIds) } })
            .select('title company jobType experienceLevel requiredSkills track')
            .lean();
        }

        // OPTIMIZATION: Merge semantic and keyword results, prioritizing semantic matches
        const allJobIds = new Set();
        semanticJobs.forEach(j => allJobIds.add(j._id.toString()));
        (fallbackJobs || []).forEach(j => allJobIds.add(j._id.toString()));

        if (allJobIds.size > 0) {
          const mergedJobs = await Job.find({ _id: { $in: Array.from(allJobIds) } })
            .select('title company jobType experienceLevel requiredSkills track')
            .lean();

          // Rank: semantic matches first, then keyword matches
          relevantJobs = [
            ...semanticJobs,
            ...mergedJobs.filter(j => !semanticJobIds.has(j._id.toString())),
          ].slice(0, 5); // Limit to top 5
        } else if (fallbackJobs) {
          relevantJobs = fallbackJobs;
        }

        relevantResources = resources || [];
      } catch (error) {
        console.error('Error fetching context:', error);
      }

      // OPTIMIZATION: Get conversation history for context
      const history = this.getConversationHistory(userId);
      
      // Build system message with context
      const systemMessage = `You are CareerBot, a friendly and helpful AI career mentor for youth seeking employment opportunities aligned with SDG 8 (Decent Work and Economic Growth).

Your role:
- Help users understand their career path
- Recommend skills to learn based on their profile
- Suggest job opportunities that match their skills
- Provide guidance on career development
- Be encouraging and supportive
- Give actionable, specific advice
- Remember previous conversation context and reference it when relevant
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
- Reference previous conversation when relevant (e.g., "As we discussed earlier...")
- Be honest about limitations and always clearly indicate suggestions, not guarantees. End responses with a brief note that these are recommendations and individual results may vary
- Encourage continuous learning and growth
- Use a friendly, encouraging, and professional tone
- Align advice with SDG 8 goals (decent work and economic growth)`;

      // Build messages array with history
      const messages = [
        { role: 'system', content: systemMessage },
        ...history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage },
      ];

      try {
        // OPTIMIZATION: Use conversation history for context-aware responses
        const aiResponse = await aiService.generateContent(messages, {
          temperature: 0.7,
          maxTokens: 500,
        });
        
        // Add to conversation history
        this.addToHistory(userId, 'user', userMessage);
        this.addToHistory(userId, 'assistant', aiResponse);

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
   * Get streaming contextual response (word-by-word)
   * Uses AI streaming for real-time word-by-word responses
   * 
   * @param {String} userId - User's MongoDB _id
   * @param {String} userMessage - User's question/message
   * @param {Function} onChunk - Callback for each chunk: (chunk: string) => void
   * @returns {Promise<Object>} Full response with metadata
   */
  async getContextualResponseStream(userId, userMessage, onChunk) {
    try {
      await this.initialize();

      // OPTIMIZATION: Use .select() and .lean() for faster queries
      const user = await User.findById(userId)
        .select('skills experienceLevel preferredTrack careerInterests educationLevel')
        .lean();
      
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

      // OPTIMIZATION: Fast parallel fetching with reduced queries
      let relevantJobs = [];
      let relevantResources = [];

      try {
        // OPTIMIZATION: Use Promise.race to timeout ChromaDB query (max 500ms)
        // This prevents ChromaDB from blocking the response
        const chromaQuery = chromaService.collection && userContext.skills.length > 0
          ? Promise.race([
              chromaService.collection.query({
                queryTexts: [userContext.skills.slice(0, 5).join(' ')], // Use only top 5 skills for speed
                nResults: 3, // OPTIMIZATION: Reduced from 5 to 3
                where: { type: 'job' },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('ChromaDB timeout')), 500))
            ]).catch(() => null)
          : Promise.resolve(null);

        // OPTIMIZATION: Parallelize all queries, but prioritize speed
        const [jobResults, fallbackJobs, resources] = await Promise.all([
          chromaQuery,
          // Fast keyword-based jobs query (always run)
          Job.find({
            $or: [
              { track: user.preferredTrack },
              { requiredSkills: { $in: user.skills.slice(0, 10) } }, // Limit skills for faster query
            ],
          })
          .select('title company jobType experienceLevel requiredSkills track')
          .lean()
          .limit(3) // OPTIMIZATION: Reduced from 5 to 3
          .catch(() => []),
          // Fast resources query
          Resource.find({
            relatedSkills: { $in: user.skills.slice(0, 10) }, // Limit skills for faster query
          })
          .select('title platform cost relatedSkills')
          .lean()
          .limit(3) // OPTIMIZATION: Reduced from 5 to 3
          .catch(() => []),
        ]);

        // OPTIMIZATION: Simplified merge logic - no extra database query
        if (jobResults && jobResults.metadatas && jobResults.metadatas[0]) {
          const semanticJobIds = jobResults.metadatas[0]
            .map(meta => meta.jobId)
            .filter(Boolean)
            .slice(0, 3); // Limit to 3

          if (semanticJobIds.length > 0) {
            // Fetch semantic jobs
            const semanticJobs = await Job.find({ _id: { $in: semanticJobIds } })
              .select('title company jobType experienceLevel requiredSkills track')
              .lean()
              .limit(3);

            // Merge: semantic first, then keyword matches
            const semanticIds = new Set(semanticJobs.map(j => j._id.toString()));
            relevantJobs = [
              ...semanticJobs,
              ...(fallbackJobs || []).filter(j => !semanticIds.has(j._id.toString())),
            ].slice(0, 3); // Limit to top 3
          } else {
            relevantJobs = (fallbackJobs || []).slice(0, 3);
          }
        } else {
          // No semantic results, use keyword matches
          relevantJobs = (fallbackJobs || []).slice(0, 3);
        }

        relevantResources = (resources || []).slice(0, 3);
      } catch (error) {
        console.error('Error fetching context:', error);
        // Continue with empty arrays - AI can still respond
      }

      // OPTIMIZATION: Get conversation history for context
      const history = this.getConversationHistory(userId);
      
      // OPTIMIZATION: Concise system message for faster AI processing
      const skillsList = userContext.skills.slice(0, 8).join(', ') || 'None';
      const jobsList = relevantJobs.length > 0
        ? relevantJobs.map(j => `${j.title} at ${j.company}`).join('; ')
        : 'None available';
      const resourcesList = relevantResources.length > 0
        ? relevantResources.map(r => `${r.title} (${r.platform})`).join('; ')
        : 'None available';

      const systemMessage = `You are CareerBot, a friendly AI career mentor for youth (SDG 8: Decent Work).

User: ${skillsList} | ${userContext.experienceLevel || 'Fresher'} | ${userContext.preferredTrack || 'Any'} track
Jobs: ${jobsList}
Resources: ${resourcesList}

Guidelines:
- Be concise (2-4 sentences for simple Qs, more for complex)
- Give actionable advice
- Reference user's skills/jobs/resources when relevant
- Use "I suggest/recommend" not guarantees
- Reference conversation history when relevant
- Friendly, encouraging tone`;

      // Build messages array with history
      const messages = [
        { role: 'system', content: systemMessage },
        ...history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage },
      ];

      try {
        // OPTIMIZATION: Reduced maxTokens for faster responses
        const fullResponse = await aiService.generateContentStream(messages, {
          temperature: 0.7,
          maxTokens: 350, // OPTIMIZATION: Reduced from 500 to 350 for faster generation
        }, onChunk);
        
        // Add to conversation history after streaming completes
        this.addToHistory(userId, 'user', userMessage);
        this.addToHistory(userId, 'assistant', fullResponse);

        return {
          response: fullResponse,
          timestamp: new Date(),
          contextUsed: {
            jobsCount: relevantJobs.length,
            resourcesCount: relevantResources.length,
            userSkillsCount: userContext.skills.length,
          },
          isAI: true,
        };
      } catch (error) {
        console.error('AI Streaming Response Generation Error:', error);
        // Fallback to rule-based response
        const fallbackResponse = this.getFallbackResponse(userMessage, userContext, relevantJobs, relevantResources);
        // Send fallback response as single chunk
        if (onChunk) {
          onChunk(fallbackResponse);
        }
        return {
          response: fallbackResponse,
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
      console.error('Career Mentor Agent Streaming Error:', error);
      throw new Error(`Failed to generate streaming response: ${error.message}`);
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

