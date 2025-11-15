const Job = require('../models/Job');
const User = require('../models/User');
const jobApplicationAgent = require('../agents/jobApplicationAgent');
const cvProfileAssistantAgent = require('../agents/cvProfileAssistantAgent');
const emailService = require('../services/emailService');

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

/**
 * Apply to a job (AI-powered application)
 * POST /jobs/:id/apply
 */
const applyToJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Fetch user and job (include address/phone fields if they exist)
    const [user, job] = await Promise.all([
      User.findById(userId)
        .select('fullName email skills experienceLevel preferredTrack experiences educationLevel careerInterests cvText address city state zip phone')
        .lean(),
      Job.findById(id).lean(),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (!job.email) {
      return res.status(400).json({
        success: false,
        message: 'Job does not have an application email address',
      });
    }

    // Generate cover letter using AI
    let coverLetterData;
    try {
      coverLetterData = await jobApplicationAgent.generateCoverLetter(userId, id);
    } catch (error) {
      console.error('Cover letter generation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate cover letter',
        error: error.message,
      });
    }

    // Get or generate CV
    let cvText = user.cvText;
    if (!cvText || cvText.trim().length === 0) {
      try {
        const cvData = await cvProfileAssistantAgent.generateCVLayout(userId);
        cvText = cvData.cvText;
      } catch (error) {
        console.error('CV generation error:', error);
        // Use fallback CV
        cvText = `CURRICULUM VITAE\n\n${user.fullName}\n${user.email}\n\nSkills: ${(user.skills || []).join(', ')}\nExperience Level: ${user.experienceLevel}\nTrack: ${user.preferredTrack}`;
      }
    }

    // Send application email
    try {
      // Build email parameters (only include fields that exist)
      const emailParams = {
        to: job.email,
        subject: coverLetterData.subject,
        applicantName: user.fullName,
        applicantEmail: user.email,
        jobTitle: job.title,
        companyName: job.company,
        coverLetter: coverLetterData.coverLetter,
        cvText: cvText,
      };
      
      // Add applicant address/phone fields if they exist
      if (user.address) emailParams.applicantAddress = user.address;
      if (user.city) emailParams.applicantCity = user.city;
      if (user.state) emailParams.applicantState = user.state;
      if (user.zip) emailParams.applicantZip = user.zip;
      if (user.phone) emailParams.applicantPhone = user.phone;
      
      // Add company address fields if they exist
      if (job.address) emailParams.companyAddress = job.address;
      if (job.city) emailParams.companyCity = job.city;
      if (job.state) emailParams.companyState = job.state;
      if (job.zip) emailParams.companyZip = job.zip;
      
      const emailResult = await emailService.sendJobApplication(emailParams);

      // Add job to user's appliedJobs array (if not already applied)
      if (!user.appliedJobs || !user.appliedJobs.includes(job._id)) {
        await User.findByIdAndUpdate(userId, {
          $addToSet: { appliedJobs: job._id },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Application submitted successfully',
        data: {
          emailSent: true,
          messageId: emailResult.messageId,
          jobTitle: job.title,
          company: job.company,
          applicationEmail: job.email,
          applied: true,
        },
      });
    } catch (error) {
      console.error('Email sending error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send application email',
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobs,
  getJobById,
  applyToJob,
};

