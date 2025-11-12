const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const {
  getRecommendedJobs,
  getRecommendedResources,
} = require('../controllers/recommendationController');

// All recommendation routes require authentication
router.use(authenticateJWT);

// Get job recommendations
router.get('/jobs', getRecommendedJobs);

// Get resource recommendations
router.get('/resources', getRecommendedResources);

module.exports = router;

