const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');

/**
 * Generate a test JWT token for a user
 * @param {string} userId - User's MongoDB _id
 * @returns {string} JWT token
 */
const generateTestToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
    { expiresIn: '1h' }
  );
};

/**
 * Create a test user and return user + token
 * @param {object} userData - User data (optional)
 * @returns {Promise<{user: object, token: string}>}
 */
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    fullName: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    ...userData,
  };

  const user = await User.create(defaultUser);
  const token = generateTestToken(user._id);

  // Remove password from user object
  const userObj = user.toObject();
  delete userObj.password;

  return { user: userObj, token };
};

/**
 * Get authorization header with token
 * @param {string} token - JWT token
 * @returns {object} Authorization header
 */
const getAuthHeader = (token) => {
  return { Authorization: `Bearer ${token}` };
};

module.exports = {
  generateTestToken,
  createTestUser,
  getAuthHeader,
};

