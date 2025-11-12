require('dotenv').config();
const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const connectDB = require('../config/database');

/**
 * Seed script for Learning Resources
 * Creates 15-20 resource entries
 */
const seedResources = async () => {
  try {
    // Connect to database
    await connectDB();

    // Clear existing resources
    await Resource.deleteMany({});
    console.log('Cleared existing resources');

    // Sample resource data
    const resources = [
      {
        title: 'Complete Web Development Bootcamp',
        platform: 'Udemy',
        url: 'https://www.udemy.com/web-development-bootcamp',
        relatedSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js'],
        cost: 'Paid',
      },
      {
        title: 'Introduction to Python Programming',
        platform: 'Coursera',
        url: 'https://www.coursera.org/python-intro',
        relatedSkills: ['Python', 'Programming', 'Data Structures'],
        cost: 'Free',
      },
      {
        title: 'React - The Complete Guide',
        platform: 'Udemy',
        url: 'https://www.udemy.com/react-complete-guide',
        relatedSkills: ['React', 'JavaScript', 'Frontend Development'],
        cost: 'Paid',
      },
      {
        title: 'MongoDB University',
        platform: 'MongoDB',
        url: 'https://university.mongodb.com',
        relatedSkills: ['MongoDB', 'Database', 'NoSQL'],
        cost: 'Free',
      },
      {
        title: 'FreeCodeCamp - Full Stack Development',
        platform: 'FreeCodeCamp',
        url: 'https://www.freecodecamp.org',
        relatedSkills: [
          'HTML',
          'CSS',
          'JavaScript',
          'React',
          'Node.js',
          'MongoDB',
        ],
        cost: 'Free',
      },
      {
        title: 'UI/UX Design Fundamentals',
        platform: 'Interaction Design Foundation',
        url: 'https://www.interaction-design.org',
        relatedSkills: ['UI Design', 'UX Design', 'User Research', 'Figma'],
        cost: 'Paid',
      },
      {
        title: 'Machine Learning Crash Course',
        platform: 'Google',
        url: 'https://developers.google.com/machine-learning/crash-course',
        relatedSkills: ['Machine Learning', 'Python', 'TensorFlow'],
        cost: 'Free',
      },
      {
        title: 'AWS Certified Solutions Architect',
        platform: 'A Cloud Guru',
        url: 'https://acloudguru.com/aws-certified-solutions-architect',
        relatedSkills: ['AWS', 'Cloud Computing', 'DevOps'],
        cost: 'Paid',
      },
      {
        title: 'The Complete Node.js Developer Course',
        platform: 'Udemy',
        url: 'https://www.udemy.com/nodejs-complete-guide',
        relatedSkills: ['Node.js', 'Express.js', 'MongoDB', 'REST API'],
        cost: 'Paid',
      },
      {
        title: 'Khan Academy - Computer Programming',
        platform: 'Khan Academy',
        url: 'https://www.khanacademy.org/computing/computer-programming',
        relatedSkills: ['JavaScript', 'HTML', 'CSS', 'Programming Basics'],
        cost: 'Free',
      },
      {
        title: 'Data Science Specialization',
        platform: 'Coursera',
        url: 'https://www.coursera.org/specializations/jhu-data-science',
        relatedSkills: ['Data Science', 'Python', 'R', 'Statistics'],
        cost: 'Paid',
      },
      {
        title: 'Git and GitHub for Beginners',
        platform: 'YouTube',
        url: 'https://www.youtube.com/git-tutorial',
        relatedSkills: ['Git', 'GitHub', 'Version Control'],
        cost: 'Free',
      },
      {
        title: 'Digital Marketing Course',
        platform: 'Google Digital Garage',
        url: 'https://learndigital.withgoogle.com/digitalgarage',
        relatedSkills: [
          'Digital Marketing',
          'SEO',
          'Social Media Marketing',
          'Google Analytics',
        ],
        cost: 'Free',
      },
      {
        title: 'Cybersecurity Essentials',
        platform: 'Cisco Networking Academy',
        url: 'https://www.netacad.com/cybersecurity',
        relatedSkills: [
          'Cybersecurity',
          'Network Security',
          'Ethical Hacking',
        ],
        cost: 'Free',
      },
      {
        title: 'Mobile App Development with Flutter',
        platform: 'Udemy',
        url: 'https://www.udemy.com/flutter-mobile-development',
        relatedSkills: ['Flutter', 'Dart', 'Mobile Development'],
        cost: 'Paid',
      },
      {
        title: 'Graphic Design Masterclass',
        platform: 'Skillshare',
        url: 'https://www.skillshare.com/graphic-design',
        relatedSkills: [
          'Photoshop',
          'Illustrator',
          'Graphic Design',
          'Branding',
        ],
        cost: 'Paid',
      },
      {
        title: 'Blockchain Development',
        platform: 'Coursera',
        url: 'https://www.coursera.org/blockchain-development',
        relatedSkills: ['Blockchain', 'Solidity', 'Ethereum', 'Smart Contracts'],
        cost: 'Paid',
      },
      {
        title: 'Product Management Fundamentals',
        platform: 'Product School',
        url: 'https://www.productschool.com',
        relatedSkills: [
          'Product Management',
          'Product Strategy',
          'Agile',
          'User Research',
        ],
        cost: 'Paid',
      },
      {
        title: 'Content Writing Mastery',
        platform: 'Udemy',
        url: 'https://www.udemy.com/content-writing',
        relatedSkills: ['Content Writing', 'SEO', 'Copywriting', 'Blogging'],
        cost: 'Paid',
      },
      {
        title: 'Game Development with Unity',
        platform: 'Unity Learn',
        url: 'https://learn.unity.com',
        relatedSkills: ['Unity', 'C#', 'Game Development', '3D Modeling'],
        cost: 'Free',
      },
    ];

    // Insert resources
    await Resource.insertMany(resources);
    console.log(`✅ Successfully seeded ${resources.length} resources`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding resources:', error);
    process.exit(1);
  }
};

// Run seed if called directly
if (require.main === module) {
  seedResources();
}

module.exports = seedResources;

