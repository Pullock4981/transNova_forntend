const express = require('express');
const router = express.Router();
const validateObjectId = require('../utils/validateObjectId');
const { getJobs, getJobById } = require('../controllers/jobController');

// Get all jobs (public, no auth required)
router.get('/', getJobs);

// Get single job by ID
router.get('/:id', validateObjectId(), getJobById);

module.exports = router;

