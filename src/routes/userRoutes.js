const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const validateObjectId = require('../utils/validateObjectId');
const {
  getCurrentUser,
  updateUserProfile,
  updateSkills,
  updateInterests,
  storeCV,
  saveJob,
  saveResource,
} = require('../controllers/userController');

// All user routes require authentication
router.use(authenticateJWT);

// Get current user profile
router.get('/me', getCurrentUser);

// Update user profile
router.put('/me', updateUserProfile);

// Update skills
router.patch('/me/skills', updateSkills);

// Update interests
router.patch('/me/interests', updateInterests);

// Store CV text
router.post('/me/cv', storeCV);

// Save job
router.post('/me/save-job/:jobId', validateObjectId('jobId'), saveJob);

// Save resource
router.post(
  '/me/save-resource/:resourceId',
  validateObjectId('resourceId'),
  saveResource
);

module.exports = router;

