const express = require('express');
const router = express.Router();
const validateObjectId = require('../utils/validateObjectId');
const {
  getResources,
  getResourceById,
} = require('../controllers/resourceController');

// Get all resources (public, no auth required)
router.get('/', getResources);

// Get single resource by ID
router.get('/:id', validateObjectId(), getResourceById);

module.exports = router;

