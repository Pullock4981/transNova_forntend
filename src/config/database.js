const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI is not defined in environment variables');
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 30000, // 30 seconds connection timeout
      retryWrites: true,
      retryReads: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    
    // Provide helpful error messages
    if (error.message.includes('ETIMEOUT') || error.message.includes('querySrv')) {
      console.error('\n🔍 Troubleshooting MongoDB Connection Timeout:');
      console.error('1. Check your internet connection');
      console.error('2. Verify MongoDB Atlas IP whitelist includes your IP (0.0.0.0/0 for all)');
      console.error('3. Check if your firewall is blocking MongoDB connections');
      console.error('4. Verify MONGO_URI in .env file is correct');
      console.error('5. Try using the standard connection string format:');
      console.error('   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n🔍 Authentication Error:');
      console.error('1. Check your MongoDB username and password in MONGO_URI');
      console.error('2. Verify database user has proper permissions');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n🔍 DNS Resolution Error:');
      console.error('1. Check your MongoDB cluster hostname in MONGO_URI');
      console.error('2. Verify cluster is active in MongoDB Atlas');
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;

