require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const connectDB = require('../config/database');

/**
 * Seed script for Jobs
 * Creates 15-20 job entries
 */
const seedJobs = async () => {
  try {
    // Connect to database
    await connectDB();

    // Clear existing jobs
    await Job.deleteMany({});
    console.log('Cleared existing jobs');

    // Sample job data
    const jobs = [
      {
        title: 'Frontend Developer Intern',
        company: 'TechStart Inc.',
        location: 'Remote',
        requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React'],
        experienceLevel: 'Fresher',
        jobType: 'Internship',
        track: 'Web Development',
      },
      {
        title: 'Junior Backend Developer',
        company: 'CloudSolutions Ltd.',
        location: 'New York, USA',
        requiredSkills: ['Node.js', 'MongoDB', 'Express.js', 'REST API'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Backend Development',
      },
      {
        title: 'UI/UX Designer',
        company: 'DesignStudio',
        location: 'San Francisco, USA',
        requiredSkills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
        experienceLevel: 'Junior',
        jobType: 'Part-time',
        track: 'Design',
      },
      {
        title: 'Mobile App Developer',
        company: 'AppMakers Co.',
        location: 'London, UK',
        requiredSkills: ['React Native', 'JavaScript', 'iOS', 'Android'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Mobile Development',
      },
      {
        title: 'Data Science Intern',
        company: 'DataInsights',
        location: 'Remote',
        requiredSkills: ['Python', 'Pandas', 'NumPy', 'Machine Learning'],
        experienceLevel: 'Fresher',
        jobType: 'Internship',
        track: 'Data Science',
      },
      {
        title: 'Full Stack Developer',
        company: 'WebTech Solutions',
        location: 'Toronto, Canada',
        requiredSkills: [
          'React',
          'Node.js',
          'MongoDB',
          'TypeScript',
          'Express.js',
        ],
        experienceLevel: 'Mid',
        jobType: 'Full-time',
        track: 'Web Development',
      },
      {
        title: 'DevOps Engineer',
        company: 'CloudInfra',
        location: 'Remote',
        requiredSkills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'DevOps',
      },
      {
        title: 'Content Writer',
        company: 'ContentHub',
        location: 'Remote',
        requiredSkills: ['Writing', 'SEO', 'Content Strategy', 'Research'],
        experienceLevel: 'Fresher',
        jobType: 'Freelance',
        track: 'Content Creation',
      },
      {
        title: 'Digital Marketing Specialist',
        company: 'MarketingPro',
        location: 'Chicago, USA',
        requiredSkills: [
          'Social Media Marketing',
          'Google Analytics',
          'SEO',
          'Content Marketing',
        ],
        experienceLevel: 'Junior',
        jobType: 'Part-time',
        track: 'Digital Marketing',
      },
      {
        title: 'Python Developer',
        company: 'CodeCraft',
        location: 'Remote',
        requiredSkills: ['Python', 'Django', 'PostgreSQL', 'REST API'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Backend Development',
      },
      {
        title: 'Graphic Designer',
        company: 'CreativeAgency',
        location: 'Los Angeles, USA',
        requiredSkills: ['Photoshop', 'Illustrator', 'InDesign', 'Branding'],
        experienceLevel: 'Fresher',
        jobType: 'Internship',
        track: 'Design',
      },
      {
        title: 'Cybersecurity Analyst',
        company: 'SecureNet',
        location: 'Remote',
        requiredSkills: [
          'Network Security',
          'Penetration Testing',
          'Linux',
          'Security Tools',
        ],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Cybersecurity',
      },
      {
        title: 'Video Editor',
        company: 'MediaStudio',
        location: 'Remote',
        requiredSkills: ['Premiere Pro', 'After Effects', 'Video Production'],
        experienceLevel: 'Fresher',
        jobType: 'Freelance',
        track: 'Media Production',
      },
      {
        title: 'Product Manager Intern',
        company: 'ProductLab',
        location: 'Seattle, USA',
        requiredSkills: [
          'Product Strategy',
          'User Research',
          'Agile',
          'Analytics',
        ],
        experienceLevel: 'Fresher',
        jobType: 'Internship',
        track: 'Product Management',
      },
      {
        title: 'Blockchain Developer',
        company: 'CryptoTech',
        location: 'Remote',
        requiredSkills: ['Solidity', 'Ethereum', 'Smart Contracts', 'Web3'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Blockchain',
      },
      {
        title: 'QA Engineer',
        company: 'QualityAssurance Inc.',
        location: 'Remote',
        requiredSkills: [
          'Manual Testing',
          'Automated Testing',
          'Selenium',
          'Test Planning',
        ],
        experienceLevel: 'Fresher',
        jobType: 'Part-time',
        track: 'Quality Assurance',
      },
      {
        title: 'Sales Representative',
        company: 'SalesForce Pro',
        location: 'Miami, USA',
        requiredSkills: ['Communication', 'CRM', 'Sales Strategy', 'Negotiation'],
        experienceLevel: 'Fresher',
        jobType: 'Full-time',
        track: 'Sales',
      },
      {
        title: 'AI/ML Engineer',
        company: 'AITech Solutions',
        location: 'Remote',
        requiredSkills: [
          'Python',
          'TensorFlow',
          'Deep Learning',
          'Neural Networks',
        ],
        experienceLevel: 'Mid',
        jobType: 'Full-time',
        track: 'Artificial Intelligence',
      },
      {
        title: 'Social Media Manager',
        company: 'SocialBuzz',
        location: 'Remote',
        requiredSkills: [
          'Social Media Strategy',
          'Content Creation',
          'Analytics',
          'Community Management',
        ],
        experienceLevel: 'Junior',
        jobType: 'Part-time',
        track: 'Digital Marketing',
      },
      {
        title: 'Game Developer',
        company: 'GameStudio',
        location: 'Remote',
        requiredSkills: ['Unity', 'C#', 'Game Design', '3D Modeling'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Game Development',
      },
    ];

    // Insert jobs
    await Job.insertMany(jobs);
    console.log(`✅ Successfully seeded ${jobs.length} jobs`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding jobs:', error);
    process.exit(1);
  }
};

// Run seed if called directly
if (require.main === module) {
  seedJobs();
}

module.exports = seedJobs;

