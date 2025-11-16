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
      // Don't throw - allow app to continue (connection will retry)
    }
  }
};

// Initialize connection on cold start
connectToDatabase().catch(console.error);

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    // Ensure database connection
    await connectToDatabase();
    
    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
};

