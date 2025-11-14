const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence } = require('@langchain/core/runnables');
const User = require('../models/User');
const Job = require('../models/Job');
const Resource = require('../models/Resource');

class CareerBotService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set, CareerBot will use fallback responses');
      this.model = null;
    } else {
      try {
        this.model = new ChatGoogleGenerativeAI({
          modelName: 'gemini-pro',
          temperature: 0.7,
          apiKey: process.env.GEMINI_API_KEY,
        });
      } catch (error) {
        console.error('CareerBot initialization error:', error);
        this.model = null;
      }
    }
  }

  async getContextualResponse(userId, userMessage) {
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
    };

    // Get relevant jobs and resources
    let relevantJobs = [];
    let relevantResources = [];

    try {
      relevantJobs = await Job.find({
        $or: [
          { track: user.preferredTrack },
          { requiredSkills: { $in: user.skills } },
        ],
      }).limit(5);

      relevantResources = await Resource.find({
        relatedSkills: { $in: user.skills },
      }).limit(5);
    } catch (error) {
      console.error('Error fetching context:', error);
    }

    const systemPrompt = `You are CareerBot, a friendly and helpful AI career mentor for youth seeking employment opportunities aligned with SDG 8 (Decent Work and Economic Growth).

Your role:
- Help users understand their career path
- Recommend skills to learn
- Suggest job opportunities
- Provide guidance on career development
- Be encouraging and supportive
- Give actionable, specific advice

User Context:
- Skills: ${userContext.skills.join(', ') || 'None listed'}
- Experience Level: ${userContext.experienceLevel}
- Preferred Track: ${userContext.preferredTrack}
- Career Interests: ${userContext.careerInterests.join(', ') || 'None'}

Available Jobs (${relevantJobs.length}):
${relevantJobs.map(j => `- ${j.title} at ${j.company} (${j.jobType})`).join('\n') || 'None available'}

Available Learning Resources (${relevantResources.length}):
${relevantResources.map(r => `- ${r.title} on ${r.platform} (${r.cost})`).join('\n') || 'None available'}

Guidelines:
- Be concise but helpful (2-3 sentences max for simple questions)
- Always suggest actionable steps
- Reference specific skills, jobs, or resources when relevant
- If asked about skills, reference the user's current skills
- If asked about jobs, mention relevant opportunities
- Be honest about limitations
- Encourage continuous learning
- Use a friendly, encouraging tone

User Question: ${userMessage}

Provide a helpful, personalized response.`;

    if (!this.model) {
      // Fallback response
      return {
        response: this.getFallbackResponse(userMessage, userContext, relevantJobs, relevantResources),
        timestamp: new Date(),
        contextUsed: {
          jobsCount: relevantJobs.length,
          resourcesCount: relevantResources.length,
        },
      };
    }

    try {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['human', '{input}'],
      ]);

      const chain = RunnableSequence.from([
        prompt,
        this.model,
      ]);

      const response = await chain.invoke({
        input: userMessage,
      });

      return {
        response: response.content,
        timestamp: new Date(),
        contextUsed: {
          jobsCount: relevantJobs.length,
          resourcesCount: relevantResources.length,
        },
      };
    } catch (error) {
      console.error('CareerBot Error:', error);
      // Fallback response
      return {
        response: this.getFallbackResponse(userMessage, userContext, relevantJobs, relevantResources),
        timestamp: new Date(),
        contextUsed: {
          jobsCount: relevantJobs.length,
          resourcesCount: relevantResources.length,
        },
      };
    }
  }

  getFallbackResponse(message, userContext, relevantJobs, relevantResources) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('skill') || lowerMessage.includes('learn')) {
      return `Based on your profile, I can see you have skills in ${userContext.skills.join(', ') || 'various areas'}. To improve your career prospects, consider learning new technologies relevant to ${userContext.preferredTrack || 'your field'}. Check out the learning resources in your dashboard for specific recommendations!`;
    }
    
    if (lowerMessage.includes('job') || lowerMessage.includes('opportunity')) {
      if (relevantJobs.length > 0) {
        return `Great question! With your ${userContext.experienceLevel} level experience in ${userContext.preferredTrack || 'your field'}, there are ${relevantJobs.length} relevant opportunities available. Check the job listings in your dashboard for matches. Would you like help improving your profile to get better matches?`;
      }
      return `With your ${userContext.experienceLevel} level experience, there are opportunities available. Check the job listings in your dashboard. You can also improve your profile to get better matches!`;
    }

    if (lowerMessage.includes('roadmap') || lowerMessage.includes('plan')) {
      return `I can help you create a personalized career roadmap! Go to your profile and use the "Generate Roadmap" feature. Specify your target role and timeframe, and I'll create a step-by-step plan for you.`;
    }

    if (lowerMessage.includes('gap') || lowerMessage.includes('missing')) {
      return `To identify skill gaps, check the job matches in your dashboard. Each job shows which skills you have and which ones you're missing. I can also recommend learning resources to close those gaps!`;
    }
    
    return `I'm here to help with your career journey! I can assist with skill recommendations, job matching, learning resources, and career planning. What would you like to know? You can ask me about skills to learn, job opportunities, or career advice.`;
  }
}

module.exports = new CareerBotService();

