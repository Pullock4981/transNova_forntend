const skillGapService = require('../services/skillGapService');
const roadmapService = require('../services/roadmapService');
const { 
  careerMentorAgent, 
  skillGapAnalysisAgent, 
  careerRoadmapAgent,
  cvProfileAssistantAgent,
  cvExtractionAgent
} = require('../agents');
const aiService = require('../services/aiService');
const chromaService = require('../services/chromaService');
const pdfService = require('../services/pdfService');
const multer = require('multer');
const Job = require('../models/Job');
const User = require('../models/User');

// Configure multer for memory storage (PDF uploads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

/**
 * Extract skills from CV text
 * POST /api/ai/extract-cv
 */
const extractCVSkills = async (req, res, next) => {
  try {
    const { cvText, preferredTrack } = req.body;

    if (!cvText) {
      return res.status(400).json({
        success: false,
        message: 'CV text is required',
      });
    }

    const extracted = await cvExtractionAgent.extractSkillsFromCV(
      cvText,
      preferredTrack
    );

    res.status(200).json({
      success: true,
      data: extracted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify tools with AI - ask AI if each item is actually a tool
 * POST /api/ai/verify-tools
 */
const verifyTools = async (req, res, next) => {
  try {
    const { tools, skills = [], technologies = [] } = req.body;

    if (!tools || !Array.isArray(tools)) {
      return res.status(400).json({
        success: false,
        message: 'Tools array is required',
      });
    }

    if (tools.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          validTools: [],
          movedToSkills: [],
          movedToTechnologies: [],
        },
      });
    }

    const verified = await cvExtractionAgent.verifyToolsWithAI(tools, skills, technologies);

    res.status(200).json({
      success: true,
      data: verified,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get enhanced job match with AI analysis
 * GET /api/ai/job-match/:jobId
 */
const getEnhancedJobMatch = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Calculate match
    const matchedSkills = user.skills.filter(userSkill =>
      job.requiredSkills.some(
        jobSkill => userSkill.toLowerCase() === jobSkill.toLowerCase()
      )
    );

    const missingSkills = job.requiredSkills.filter(
      jobSkill => !user.skills.some(
        userSkill => userSkill.toLowerCase() === jobSkill.toLowerCase()
      )
    );

    const matchPercentage = Math.round(
      (matchedSkills.length / job.requiredSkills.length) * 100
    );

    // Get AI explanation
    const prompt = `Analyze job match and provide explanation:

User Skills: ${user.skills.join(', ') || 'None'}
Job Title: ${job.title}
Job Required Skills: ${job.requiredSkills.join(', ')}
Matched Skills: ${matchedSkills.join(', ') || 'None'}
Missing Skills: ${missingSkills.join(', ') || 'None'}
Match Percentage: ${matchPercentage}%
User Experience Level: ${user.experienceLevel}
Job Experience Level: ${job.experienceLevel}

Provide:
1. Why this is a ${matchPercentage}% match
2. What makes user qualified
3. What's missing
4. Where to apply (LinkedIn, BDjobs, Glassdoor, etc.)
5. Application tips

Return JSON:
{
  "matchPercentage": ${matchPercentage},
  "explanation": "Detailed explanation in 2-3 sentences",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "suggestedPlatforms": ["LinkedIn", "BDjobs", "Glassdoor"],
  "applicationTips": ["tip1", "tip2"]
}`;

    let aiAnalysis;
    try {
      aiAnalysis = await aiService.generateStructuredJSON(prompt);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      aiAnalysis = {
        explanation: `You match ${matchPercentage}% of required skills. ${matchedSkills.length > 0 ? `You have strong skills in ${matchedSkills.join(', ')}.` : ''} ${missingSkills.length > 0 ? `Consider learning ${missingSkills.slice(0, 3).join(', ')}.` : ''}`,
        strengths: matchedSkills,
        gaps: missingSkills,
        suggestedPlatforms: ['LinkedIn', 'BDjobs', 'Glassdoor'],
        applicationTips: [
          'Tailor your resume to highlight relevant skills',
          'Write a compelling cover letter',
          'Prepare for technical interviews',
        ],
      };
    }

    // Get skill gap analysis using Skill Gap Analysis Agent
    let gapAnalysis;
    try {
      gapAnalysis = await skillGapAnalysisAgent.analyzeSkillGaps(user, job);
    } catch (error) {
      console.error('Skill Gap Analysis Agent Error:', error);
      // Fallback to old service
      try {
        gapAnalysis = await skillGapService.analyzeSkillGaps(
          user.skills,
          job.requiredSkills,
          userId
        );
      } catch (fallbackError) {
        console.error('Fallback Gap Analysis Error:', fallbackError);
        gapAnalysis = {
          missingSkills,
          recommendations: [],
          message: 'Unable to generate detailed gap analysis',
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        matchPercentage,
        matchedSkills,
        missingSkills,
        aiAnalysis,
        gapAnalysis,
        job: {
          _id: job._id,
          title: job.title,
          company: job.company,
          location: job.location,
          requiredSkills: job.requiredSkills,
          experienceLevel: job.experienceLevel,
          jobType: job.jobType,
          track: job.track,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate career roadmap
 * POST /api/ai/roadmap
 */
const generateRoadmap = async (req, res, next) => {
  try {
    const { targetRole, timeframe, availableHours } = req.body;
    const userId = req.user.userId;

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: 'Target role is required',
      });
    }

    // Use Career Roadmap Agent
    const roadmap = await careerRoadmapAgent.generateRoadmap(
      userId,
      targetRole,
      timeframe || 6,
      availableHours || 10
    );

    res.status(200).json({
      success: true,
      data: roadmap,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user roadmaps
 * GET /api/ai/roadmaps
 */
const getUserRoadmaps = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // Use Career Roadmap Agent
    const roadmaps = await careerRoadmapAgent.getUserRoadmaps(userId);

    res.status(200).json({
      success: true,
      data: roadmaps,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific roadmap
 * GET /api/ai/roadmap/:roadmapId
 */
const getRoadmap = async (req, res, next) => {
  try {
    const { roadmapId } = req.params;
    const userId = req.user.userId;

    // Use Career Roadmap Agent
    const roadmap = await careerRoadmapAgent.getRoadmapById(roadmapId, userId);

    res.status(200).json({
      success: true,
      data: roadmap,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete roadmap
 * DELETE /api/ai/roadmap/:roadmapId
 */
const deleteRoadmap = async (req, res, next) => {
  try {
    const { roadmapId } = req.params;
    const userId = req.user.userId;

    // Use Career Roadmap Agent
    await careerRoadmapAgent.deleteRoadmap(roadmapId, userId);

    res.status(200).json({
      success: true,
      message: 'Roadmap deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Chat with CareerBot
 * POST /api/ai/chat
 */
const chatWithCareerBot = async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const response = await careerMentorAgent.getContextualResponse(
      userId,
      message
    );

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload and extract CV from PDF
 * POST /api/ai/upload-cv
 */
const uploadCV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'PDF file is required',
      });
    }

    // Extract text from PDF
    const cvText = await pdfService.extractTextFromPDF(req.file.buffer);
    
    // Extract skills using AI
    const preferredTrack = req.body.preferredTrack || '';
    const extracted = await cvExtractionAgent.extractSkillsFromCV(
      cvText,
      preferredTrack
    );

    res.status(200).json({
      success: true,
      data: {
        ...extracted,
        extractedText: cvText, // Include extracted text for user to review
        fileName: req.file.originalname,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize ChromaDB (for testing/admin)
 * POST /api/ai/init-chroma
 */
const initializeChroma = async (req, res, next) => {
  try {
    await chromaService.initialize();
    
    // Optionally seed with some skills
    const commonSkills = [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
      'HTML', 'CSS', 'SQL', 'MongoDB', 'Git', 'AWS', 'Docker'
    ];
    
    await chromaService.addSkills(commonSkills);

    res.status(200).json({
      success: true,
      message: 'ChromaDB initialized successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate professional summary
 * POST /api/ai/cv/summary
 */
const generateProfessionalSummary = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const summary = await cvProfileAssistantAgent.generateProfessionalSummary(userId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suggest bullet points for experience/project
 * POST /api/ai/cv/bullet-points
 */
const suggestBulletPoints = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { experience } = req.body; // Optional: specific experience object

    const bullets = await cvProfileAssistantAgent.suggestBulletPoints(userId, experience || null);

    res.status(200).json({
      success: true,
      data: bullets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get LinkedIn and portfolio recommendations
 * GET /api/ai/cv/recommendations
 */
const getLinkedInRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const recommendations = await cvProfileAssistantAgent.getLinkedInRecommendations(userId);

    res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate CV layout
 * POST /api/ai/cv/generate
 */
const generateCVLayout = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const options = req.body.options || {};

    const cv = await cvProfileAssistantAgent.generateCVLayout(userId, options);

    res.status(200).json({
      success: true,
      data: cv,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyTools,
  extractCVSkills,
  getEnhancedJobMatch,
  generateRoadmap,
  getUserRoadmaps,
  getRoadmap,
  deleteRoadmap,
  chatWithCareerBot,
  uploadCV,
  upload, // Export multer middleware
  initializeChroma,
  generateProfessionalSummary,
  suggestBulletPoints,
  getLinkedInRecommendations,
  generateCVLayout,
};

