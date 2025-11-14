const app = require('../app');
const connectDB = require('../src/config/database');

// Connect to MongoDB (Vercel will reuse connections)
let isConnected = false;

const connectToDatabase = async () => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
      console.log('✅ MongoDB connected (Vercel)');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      isConnected = false;
      throw error;
    }
  }
};

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    // Connect to database on first request
    await connectToDatabase();
    
    // Handle the request with Express app
    app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
};

