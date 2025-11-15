require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

/**
 * Seed script for Admin User
 * Creates admin user with credentials: admin@admin.com / admin1234
 */
const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@admin.com' });

    if (existingAdmin) {
      // Update existing user to admin role
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      } else {
        console.log('ℹ️  Admin user already exists with admin role');
      }
    } else {
      // Create new admin user
      const adminUser = await User.create({
        fullName: 'Admin User',
        email: 'admin@admin.com',
        password: 'admin1234', // Will be hashed by pre-save hook
        role: 'admin',
        experienceLevel: 'Mid',
        preferredTrack: 'Administration',
      });

      console.log('✅ Successfully created admin user');
      console.log('   Email: admin@admin.com');
      console.log('   Password: admin1234');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  }
};

// Run seed if called directly
if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;

