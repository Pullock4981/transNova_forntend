require('dotenv').config({ path: '.env.test' });

// Set test environment variables if not set
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sdg8-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '1h';

// Increase timeout for database operations
jest.setTimeout(10000);

