const User = require('../models/User');
const Job = require('../models/Job');
const Resource = require('../models/Resource');
const skillRecommendationAgent = require('../agents/skillRecommendationAgent');
const emailService = require('../services/emailService');
const bdjobsScraper = require('../services/bdjobsScraper');

// ============ JOBS MANAGEMENT ============

const getAllJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const { title, company, location, requiredSkills, experienceLevel, jobType, track, email } = req.body;
    
    const job = await Job.create({
      title,
      company,
      location,
      requiredSkills: requiredSkills || [],
      experienceLevel,
      jobType,
      track,
      email: email || '',
    });
    
    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const updateJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, company, location, requiredSkills, experienceLevel, jobType, track, email } = req.body;
    
    const job = await Job.findByIdAndUpdate(
      id,
      {
        title,
        company,
        location,
        requiredSkills: requiredSkills || [],
        experienceLevel,
        jobType,
        track,
        email: email || '',
      },
      { new: true, runValidators: true }
    );
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

const deleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndDelete(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============ RESOURCES MANAGEMENT ============

const getAllResources = async (req, res, next) => {
  try {
    const resources = await Resource.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: resources.length,
      data: resources,
    });
  } catch (error) {
    next(error);
  }
};

const createResource = async (req, res, next) => {
  try {
    const { title, platform, url, relatedSkills, cost } = req.body;
    
    const resource = await Resource.create({
      title,
      platform,
      url,
      relatedSkills: relatedSkills || [],
      cost,
    });
    
    res.status(201).json({
      success: true,
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};

const updateResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, platform, url, relatedSkills, cost } = req.body;
    
    const resource = await Resource.findByIdAndUpdate(
      id,
      {
        title,
        platform,
        url,
        relatedSkills: relatedSkills || [],
        cost,
      },
      { new: true, runValidators: true }
    );
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};

const deleteResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findByIdAndDelete(id);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============ SKILLS/DOMAINS MANAGEMENT ============

const getAllSkills = async (req, res, next) => {
  try {
    // Get all unique skills from users
    const users = await User.find({ skills: { $exists: true, $ne: [] } });
    const allSkills = new Set();
    
    users.forEach(user => {
      if (user.skills && Array.isArray(user.skills)) {
        user.skills.forEach(skill => allSkills.add(skill));
      }
    });
    
    // Get all unique skills from jobs
    const jobs = await Job.find({ requiredSkills: { $exists: true, $ne: [] } });
    jobs.forEach(job => {
      if (job.requiredSkills && Array.isArray(job.requiredSkills)) {
        job.requiredSkills.forEach(skill => allSkills.add(skill));
      }
    });
    
    // Get all unique tracks/domains
    const tracks = await Job.distinct('track');
    const userTracks = await User.distinct('preferredTrack');
    const allTracks = [...new Set([...tracks, ...userTracks])].filter(Boolean);
    
    res.status(200).json({
      success: true,
      data: {
        skills: Array.from(allSkills).sort(),
        domains: allTracks.sort(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const addDomain = async (req, res, next) => {
  try {
    const { domain } = req.body;
    
    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Domain name is required',
      });
    }
    
    // Check if domain already exists
    const existingDomain = await Job.findOne({ 
      track: domain.trim(),
      title: '[DOMAIN_PLACEHOLDER]', // Mark as placeholder
    });
    
    if (existingDomain) {
      return res.status(400).json({
        success: false,
        message: 'Domain already exists',
      });
    }
    
    // Create a placeholder job to represent this domain
    const placeholderJob = await Job.create({
      title: '[DOMAIN_PLACEHOLDER]',
      company: 'System',
      location: 'N/A',
      requiredSkills: [],
      experienceLevel: 'Fresher',
      jobType: 'Full-time',
      track: domain.trim(),
      description: 'This is a placeholder job to represent a domain/track.',
    });
    
    res.status(201).json({
      success: true,
      message: 'Domain added successfully',
      data: { domain: domain.trim() },
    });
  } catch (error) {
    next(error);
  }
};

const removeDomain = async (req, res, next) => {
  try {
    const { domain } = req.body;
    
    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Domain name is required',
      });
    }
    
    // Delete all placeholder jobs with this track
    const result = await Job.deleteMany({
      track: domain.trim(),
      title: '[DOMAIN_PLACEHOLDER]',
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found or cannot be removed (may be in use by real jobs)',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Domain removed successfully',
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

// ============ USERS MANAGEMENT ============

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// ============ SKILL RECOMMENDATIONS ============

const sendSkillRecommendationsToAllUsers = async (req, res, next) => {
  try {
    // Set a longer timeout for this endpoint (10 minutes)
    req.setTimeout(600000);

    // Get all users (excluding admins) - only those with email
    const users = await User.find({ 
      role: { $ne: 'admin' },
      email: { $exists: true, $ne: '' }
    })
      .select('fullName email skills preferredTrack experienceLevel educationLevel careerInterests')
      .lean();

    if (users.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users found to process',
        processed: 0,
        successful: 0,
        failed: 0,
      });
    }

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Pre-fetch all jobs once (optimization)
    const allJobs = await Job.find()
      .select('title company requiredSkills experienceLevel track jobType location')
      .lean();

    console.log(`📧 Starting skill recommendations for ${users.length} users...`);

    // Process users one by one
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        results.processed++;

        // Skip users without email (shouldn't happen due to query, but double-check)
        if (!user.email) {
          results.failed++;
          results.errors.push({
            userId: user._id,
            email: user.email,
            error: 'No email address',
          });
          continue;
        }

        console.log(`Processing user ${i + 1}/${users.length}: ${user.email}`);

        // Analyze user skills (optimized to use pre-fetched jobs)
        const analysis = await skillRecommendationAgent.analyzeUserSkills(user, allJobs);

        // Skip if no recommendations
        if (!analysis.recommendedSkills || analysis.recommendedSkills.length === 0) {
          results.failed++;
          results.errors.push({
            userId: user._id,
            email: user.email,
            error: 'No skills recommended',
          });
          continue;
        }

        // Send email
        await emailService.sendSkillRecommendations({
          to: user.email,
          userName: user.fullName || 'User',
          recommendedSkills: analysis.recommendedSkills,
          analysis: analysis.analysis,
          reasoning: analysis.reasoning,
        });

        results.successful++;
        console.log(`✓ Sent to ${user.email} (${results.successful}/${users.length})`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId: user._id,
          email: user.email,
          error: error.message,
        });
        console.error(`✗ Error processing user ${user._id} (${user.email}):`, error.message);
      }
    }

    console.log(`✅ Completed: ${results.successful} successful, ${results.failed} failed`);

    res.status(200).json({
      success: true,
      message: `Processed ${results.processed} users. ${results.successful} emails sent successfully, ${results.failed} failed.`,
      ...results,
    });
  } catch (error) {
    next(error);
  }
};

// ============ BDJOBS SCRAPING ============

const scrapeBdjobsJobs = async (req, res, next) => {
  try {
    const { maxJobs = 50 } = req.body;

    console.log(`📥 Admin requested to scrape ${maxJobs} jobs from bdjobs.com`);

    const result = await bdjobsScraper.scrapeAndSave(maxJobs);

    res.status(200).json({
      success: true,
      message: result.message || `Scraped and saved ${result.saved} jobs from bdjobs.com`,
      data: {
        saved: result.saved,
        skipped: result.skipped,
        totalScraped: result.saved + result.skipped,
        jobs: result.jobs || [],
      },
    });
  } catch (error) {
    console.error('❌ Error in scrapeBdjobsJobs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to scrape jobs from bdjobs.com',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

module.exports = {
  // Jobs
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
  // Resources
  getAllResources,
  createResource,
  updateResource,
  deleteResource,
  // Skills/Domains
  getAllSkills,
  addDomain,
  removeDomain,
  // Users
  getAllUsers,
  getUserById,
  // Skill Recommendations
  sendSkillRecommendationsToAllUsers,
  // Bdjobs Scraping
  scrapeBdjobsJobs,
};

