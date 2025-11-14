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
  uploadCV,
  upload,
  initializeChroma,
  generateProfessionalSummary,
  suggestBulletPoints,
  getLinkedInRecommendations,
  generateCVLayout,
} = require('../controllers/aiController');

// All AI routes require authentication
router.use(authenticateJWT);

// Extract skills from CV text
router.post('/extract-cv', extractCVSkills);

// Verify tools with AI
router.post('/verify-tools', verifyTools);

// Upload and extract CV from PDF
router.post('/upload-cv', upload.single('cvFile'), uploadCV);

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

// Initialize ChromaDB (optional, for admin/testing)
router.post('/init-chroma', initializeChroma);

// CV / Profile Assistant endpoints
router.post('/cv/summary', generateProfessionalSummary);
router.post('/cv/bullet-points', suggestBulletPoints);
router.get('/cv/recommendations', getLinkedInRecommendations);
router.post('/cv/generate', generateCVLayout);

module.exports = router;

