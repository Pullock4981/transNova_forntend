const express = require('express');
const router = express.Router();
const validateObjectId = require('../utils/validateObjectId');
const authenticateJWT = require('../middleware/authenticateJWT');
const { getJobs, getJobById, applyToJob } = require('../controllers/jobController');

// Get all jobs (public, no auth required)
router.get('/', getJobs);

// Get single job by ID
router.get('/:id', validateObjectId(), getJobById);

// Apply to a job (requires authentication)
router.post('/:id/apply', authenticateJWT, validateObjectId(), applyToJob);

module.exports = router;

