const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const validateObjectId = require('../utils/validateObjectId');
const {
  extractCVSkills,
  verifyTools,
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
  upload,
  imageUpload,
  initializeChroma,
  generateProfessionalSummary,
  generateProfessionalSummaryStream,
  suggestBulletPoints,
  getLinkedInRecommendations,
  getLinkedInRecommendationsStream,
  generateCVLayout,
  generateCVLayoutStream,
} = require('../controllers/aiController');

// All AI routes require authentication
router.use(authenticateJWT);

// Extract skills from CV text
router.post('/extract-cv', extractCVSkills);

// Verify tools with AI
router.post('/verify-tools', verifyTools);

// Upload and extract CV from PDF
router.post('/upload-cv', upload.single('cvFile'), uploadCV);

// Process photo for CV (make it formal)
router.post('/process-photo', imageUpload.single('photo'), processPhotoForCV);

// Get enhanced job match
router.get('/job-match/:jobId', validateObjectId('jobId'), getEnhancedJobMatch);

// Generate career roadmap
router.post('/roadmap', generateRoadmap);

// Get user roadmaps
router.get('/roadmaps', getUserRoadmaps);

// Get specific roadmap
router.get('/roadmap/:roadmapId', validateObjectId('roadmapId'), getRoadmap);

// Delete roadmap
router.delete('/roadmap/:roadmapId', validateObjectId('roadmapId'), deleteRoadmap);

// Chat with CareerBot
router.post('/chat', chatWithCareerBot);

// Chat with CareerBot (Streaming - word-by-word)
router.post('/chat-stream', chatWithCareerBotStream);

// Get conversation history
router.get('/chat-history', getChatHistory);

// Clear conversation history
router.delete('/chat-history', clearChatHistory);

// Initialize ChromaDB (optional, for admin/testing)
router.post('/init-chroma', initializeChroma);

// CV / Profile Assistant endpoints
router.post('/cv/summary', generateProfessionalSummary);
router.post('/cv/summary-stream', generateProfessionalSummaryStream);
router.post('/cv/bullet-points', suggestBulletPoints);
router.get('/cv/recommendations', getLinkedInRecommendations);
router.get('/cv/recommendations-stream', getLinkedInRecommendationsStream);
router.post('/cv/generate', generateCVLayout);
router.post('/cv/generate-stream', generateCVLayoutStream);

module.exports = router;

