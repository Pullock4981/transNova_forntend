const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const { getDashboard } = require('../controllers/dashboardController');

// Dashboard route requires authentication
router.use(authenticateJWT);

// Get dashboard data
router.get('/', getDashboard);

module.exports = router;

