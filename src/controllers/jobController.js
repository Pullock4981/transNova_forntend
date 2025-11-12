const Job = require('../models/Job');

/**
 * Get all jobs with optional filters
 * GET /jobs
 * Query params: track, location, type, experienceLevel
 */
const getJobs = async (req, res, next) => {
  try {
    const { track, location, type, experienceLevel } = req.query;

    // Build filter object
    const filter = {};

    if (track) {
      filter.track = { $regex: track, $options: 'i' };
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (type) {
      filter.jobType = type;
    }

    if (experienceLevel) {
      filter.experienceLevel = { $regex: experienceLevel, $options: 'i' };
    }

    const jobs = await Job.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single job by ID
 * GET /jobs/:id
 */
const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

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

module.exports = {
  getJobs,
  getJobById,
};

