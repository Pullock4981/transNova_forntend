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
        email: 'shafinahnam89@gmail.com'
      },
      {
        title: 'Junior Backend Developer',
        company: 'CloudSolutions Ltd.',
        location: 'New York, USA',
        requiredSkills: ['Node.js', 'MongoDB', 'Express.js', 'REST API'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Backend Development',
        email: 'mashrafiahnam1@gmail.com'
      },
      {
        title: 'UI/UX Designer',
        company: 'DesignStudio',
        location: 'San Francisco, USA',
        requiredSkills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
        experienceLevel: 'Junior',
        jobType: 'Part-time',
        track: 'Design',
        email: 'mashrafiahnam987@gmail.com'
      },
      {
        title: 'Mobile App Developer',
        company: 'AppMakers Co.',
        location: 'London, UK',
        requiredSkills: ['React Native', 'JavaScript', 'iOS', 'Android'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Mobile Development',
        email: 'shafinahnam89@gmail.com'
      },
      {
        title: 'Data Science Intern',
        company: 'DataInsights',
        location: 'Remote',
        requiredSkills: ['Python', 'Pandas', 'NumPy', 'Machine Learning'],
        experienceLevel: 'Fresher',
        jobType: 'Internship',
        track: 'Data Science',
        email: 'mashrafiahnam1@gmail.com'
      },
      {
        title: 'Full Stack Developer',
        company: 'WebTech Solutions',
        location: 'Toronto, Canada',
        requiredSkills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Express.js'],
        experienceLevel: 'Mid',
        jobType: 'Full-time',
        track: 'Web Development',
        email: 'mashrafiahnam987@gmail.com'
      },
      {
        title: 'DevOps Engineer',
        company: 'CloudInfra',
        location: 'Remote',
        requiredSkills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'DevOps',
        email: 'shafinahnam89@gmail.com'
      },
      {
        title: 'Content Writer',
        company: 'ContentHub',
        location: 'Remote',
        requiredSkills: ['Writing', 'SEO', 'Content Strategy', 'Research'],
        experienceLevel: 'Fresher',
        jobType: 'Freelance',
        track: 'Content Creation',
        email: 'mashrafiahnam1@gmail.com'
      },
      {
        title: 'Digital Marketing Specialist',
        company: 'MarketingPro',
        location: 'Chicago, USA',
        requiredSkills: ['Social Media Marketing', 'Google Analytics', 'SEO', 'Content Marketing'],
        experienceLevel: 'Junior',
        jobType: 'Part-time',
        track: 'Digital Marketing',
        email: 'mashrafiahnam987@gmail.com'
      },
      {
        title: 'Python Developer',
        company: 'CodeCraft',
        location: 'Remote',
        requiredSkills: ['Python', 'Django', 'PostgreSQL', 'REST API'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Backend Development',
        email: 'shafinahnam89@gmail.com'
      }
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

