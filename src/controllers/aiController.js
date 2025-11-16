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
const aiJobMatchingService = require('../services/aiJobMatchingService');
const chromaService = require('../services/chromaService');
const pdfService = require('../services/pdfService');
const photoProcessingService = require('../services/photoProcessingService');
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

// Configure multer for image uploads (photo processing)
const imageUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
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
/**
 * Get enhanced job match with embeddings
 * GET /api/ai/job-match/:jobId
 * OPTIMIZED: Now uses embeddings for semantic matching
 */
const getEnhancedJobMatch = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    // OPTIMIZATION: Use .select() and .lean() for faster queries
    const [user, job] = await Promise.all([
      User.findById(userId)
        .select('_id fullName email skills experienceLevel preferredTrack careerInterests')
        .lean(),
      Job.findById(jobId).lean(),
    ]);

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

    // OPTIMIZATION: Fast job matching with timeout (max 1 second)
    // Skip embeddings and AI in critical path for speed
    let matchAnalysis;
    try {
      // Use Promise.race with aggressive timeout
      matchAnalysis = await Promise.race([
        aiJobMatchingService.analyzeJobMatch(user, job, {
          skipEmbedding: true,  // OPTIMIZATION: Skip embeddings for speed
          skipAIReasons: true   // OPTIMIZATION: Skip AI reasons for speed
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Match analysis timeout')), 1000))
      ]);
    } catch (error) {
      // Fast fallback - simple matching (instant, synchronous)
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
      
      matchAnalysis = {
        matchPercentage,
        matchedSkills,
        missingSkills,
        matchScore: matchPercentage / 100,
        embeddingBased: false,
        keyReasons: [`Matches ${matchedSkills.length} of ${job.requiredSkills.length} required skills`],
        applicationPlatforms: [
          { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs' },
          { name: 'BDjobs', url: 'https://www.bdjobs.com' },
        ],
      };
    }

    // Enhance match analysis in background (non-blocking)
    setImmediate(() => {
      aiJobMatchingService.analyzeJobMatch(user, job, {
        skipEmbedding: false,
        skipAIReasons: false
      })
        .then(enhanced => {
          console.log('Background enhanced match analysis completed');
        })
        .catch(() => {});
    });

    if (!matchAnalysis) {
      return res.status(200).json({
        success: true,
        data: {
          matchPercentage: 0,
          matchedSkills: [],
          missingSkills: job.requiredSkills || [],
          message: 'No match found',
          embeddingBased: false,
        },
      });
    }

    // OPTIMIZATION: Generate skill gap analysis instantly (synchronous, no wait)
    // Don't wait for agent - generate basic analysis immediately
    const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
    const jobRequiredSkills = (job.requiredSkills || []).map(s => s.toLowerCase().trim());
    const missingSkills = jobRequiredSkills.filter(
      jobSkill => !userSkills.some(
        userSkill => userSkill === jobSkill || 
        userSkill.includes(jobSkill) || 
        jobSkill.includes(userSkill)
      )
    );

    const gapAnalysis = {
      missingSkills,
      prioritizedSkills: missingSkills.map((skill, idx) => ({
        skill,
        priority: 100 - (idx * 5),
        isCore: ['javascript', 'python', 'html', 'css', 'sql', 'git'].some(cs => 
          skill.toLowerCase().includes(cs)
        ),
      })),
      recommendations: missingSkills.map(skill => ({
        skill,
        priority: 50,
        resources: [
          {
            name: `${skill} Tutorial`,
            type: 'Tutorial',
            url: '#',
            source: 'template',
          }
        ],
        estimatedTime: '2-4 weeks',
        prerequisites: ['Basic programming knowledge'],
        projectIdeas: [`Build a project using ${skill}`],
        learningPath: [
          `Week 1: Learn ${skill} fundamentals`,
          `Week 2: Practice with exercises`,
          `Week 3: Build a project`,
          `Week 4: Refine and add to portfolio`
        ],
      })),
      totalGaps: missingSkills.length,
      message: missingSkills.length === 0 
        ? 'You have all required skills! 🎉' 
        : `You're missing ${missingSkills.length} key skill(s)`,
    };

    // Enhance in background (completely non-blocking - fire and forget)
    setImmediate(() => {
      skillGapAnalysisAgent.analyzeSkillGaps(user, job)
        .then(enhanced => {
          console.log('Background gap analysis completed');
        })
        .catch(() => {});
    });

    res.status(200).json({
      success: true,
      data: {
        matchPercentage: matchAnalysis.matchPercentage || 0,
        matchedSkills: matchAnalysis.matchedSkills || [],
        missingSkills: matchAnalysis.missingSkills || [],
        matchScore: matchAnalysis.matchScore,
        embeddingSimilarity: matchAnalysis.embeddingSimilarity,
        embeddingBased: matchAnalysis.embeddingBased || false,
        keyReasons: matchAnalysis.keyReasons || [],
        applicationPlatforms: matchAnalysis.applicationPlatforms || [],
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
 * Get conversation history for CareerBot
 * GET /api/ai/chat-history
 */
const getChatHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    const messages = await careerMentorAgent.getAllMessages(userId);
    
    res.status(200).json({
      success: true,
      data: {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear conversation history for CareerBot
 * DELETE /api/ai/chat-history
 */
const clearChatHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    await careerMentorAgent.clearHistory(userId);
    
    res.status(200).json({
      success: true,
      message: 'Conversation history cleared',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Chat with CareerBot (Streaming - word-by-word)
 * POST /api/ai/chat-stream
 * Uses Server-Sent Events (SSE) for real-time streaming
 */
const chatWithCareerBotStream = async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*'); // CORS for SSE

    // Stream response word-by-word
    try {
      await careerMentorAgent.getContextualResponseStream(
        userId,
        message,
        (chunk) => {
          // Send each chunk as SSE event
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      );

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      // Send error as SSE event
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    // If headers not sent yet, send JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    // Otherwise, send error as SSE
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
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
 * Process photo for CV - Make it formal/professional
 * POST /api/ai/process-photo
 * Returns the processed image as a downloadable file
 */
const processPhotoForCV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Photo file is required',
      });
    }

    const { backgroundColor = 'white' } = req.body;

    // Validate image
    await photoProcessingService.validateImage(req.file.buffer);

    // Process photo
    const processed = await photoProcessingService.processPhotoForCV(
      req.file.buffer,
      backgroundColor,
      {
        removeBg: true,
        resize: true,
        targetSize: 400,
      }
    );

    // Return as downloadable file instead of JSON (to avoid payload size limits)
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="cv-photo-formal.png"');
    res.setHeader('Content-Length', processed.imageBuffer.length);
    res.send(processed.imageBuffer);
  } catch (error) {
    console.error('Photo processing error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process photo',
      });
    }
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
 * Generate professional summary with streaming
 * POST /api/ai/cv/summary-stream
 */
const generateProfessionalSummaryStream = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      // Stream the response and get the full result
      const result = await cvProfileAssistantAgent.generateProfessionalSummaryStream(
        userId,
        (chunk) => {
          // Send each chunk as SSE event
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      );
      
      // Send the complete structured response
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        data: {
          summary: result.summary,
          suggestions: result.suggestions,
          keywords: result.keywords,
        }
      })}\n\n`);

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
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
 * Get LinkedIn and portfolio recommendations with streaming
 * GET /api/ai/cv/recommendations-stream
 */
const getLinkedInRecommendationsStream = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      // Stream the response and get the full result
      const result = await cvProfileAssistantAgent.getLinkedInRecommendationsStream(
        userId,
        (chunk) => {
          // Send each chunk as SSE event
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      );
      
      // Send the complete structured response
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        data: {
          linkedInRecommendations: result.linkedInRecommendations,
          portfolioRecommendations: result.portfolioRecommendations,
          generalTips: result.generalTips,
        }
      })}\n\n`);

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
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

/**
 * Generate CV layout with streaming
 * POST /api/ai/cv/generate-stream
 */
const generateCVLayoutStream = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const options = req.body.options || {};

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      // Stream the CV and get the full result
      // OPTIMIZATION: Send chunks immediately for faster, smoother streaming
      const result = await cvProfileAssistantAgent.generateCVLayoutStream(
        userId,
        options,
        (chunk) => {
          // Send each chunk immediately for fastest streaming
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      );
      
      // Send the complete structured response
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        data: {
          cvText: result.cvText,
          generatedAt: result.generatedAt,
        }
      })}\n\n`);

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
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
  chatWithCareerBotStream,
  getChatHistory,
  clearChatHistory,
  uploadCV,
  processPhotoForCV,
  upload, // Export multer middleware
  imageUpload, // Export image upload middleware
  initializeChroma,
  generateProfessionalSummary,
  generateProfessionalSummaryStream,
  suggestBulletPoints,
  getLinkedInRecommendations,
  getLinkedInRecommendationsStream,
  generateCVLayout,
  generateCVLayoutStream,
};

