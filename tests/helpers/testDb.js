const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Connect to in-memory MongoDB for testing
 */
const connectTestDB = async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Test MongoDB Connected');
  } catch (error) {
    console.error('Test DB connection error:', error);
    throw error;
  }
};

/**
 * Close database connection and stop in-memory server
 */
const closeTestDB = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    console.log('Test MongoDB Disconnected');
  } catch (error) {
    console.error('Error closing test DB:', error);
    throw error;
  }
};

/**
 * Clear all collections in test database
 */
const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error('Error clearing test DB:', error);
    throw error;
  }
};

module.exports = {
  connectTestDB,
  closeTestDB,
  clearTestDB,
};

