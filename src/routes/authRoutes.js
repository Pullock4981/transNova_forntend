const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const { register, login, getMe } = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected route
router.get('/me', authenticateJWT, getMe);

module.exports = router;

