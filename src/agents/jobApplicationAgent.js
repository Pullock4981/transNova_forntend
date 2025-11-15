const aiService = require('../services/aiService');
const User = require('../models/User');
const Job = require('../models/Job');
const chromaService = require('../services/chromaService');
const jobMatchPercentageAgent = require('./jobMatchPercentageAgent');

/**
 * Job Application Agent
 * 
 * Generates personalized cover letters for job applications
 * Uses embeddings for better job analysis
 */
class JobApplicationAgent {
  /**
   * Initialize ChromaDB for semantic search
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
    if (!jobMatchPercentageAgent.initialized) {
      await jobMatchPercentageAgent.initialize();
    }
  }

  /**
   * Find similar jobs using embeddings for better context
   * @param {Object} job - Job object
   * @returns {Array} Array of similar jobs
   */
  async findSimilarJobs(job) {
    try {
      await this.initialize();
      
      if (!chromaService.collection) {
        return [];
      }

      // Create job text for semantic search
      const jobText = [
        job.title,
        job.company,
        ...(job.requiredSkills || []),
        job.track,
        job.experienceLevel,
      ].filter(Boolean).join(' ');

      // Search for similar jobs
      const similarJobs = await chromaService.collection.query({
        queryTexts: [jobText],
        nResults: 3,
        where: { type: 'job' },
      });

      if (similarJobs.metadatas && similarJobs.metadatas[0]) {
        const jobIds = similarJobs.metadatas[0]
          .map(meta => meta.jobId)
          .filter(Boolean)
          .filter(id => id !== job._id.toString()); // Exclude current job
        
        if (jobIds.length > 0) {
          const similarJobsData = await Job.find({ _id: { $in: jobIds } })
            .select('title company requiredSkills experienceLevel track jobType')
            .lean()
            .limit(3);
          
          return similarJobsData;
        }
      }

      return [];
    } catch (error) {
      console.warn('Error finding similar jobs:', error.message);
      return [];
    }
  }

  /**
   * Build user context, only including fields that exist
   * @param {Object} user - User object
   * @returns {Object} User context with only existing fields
   */
  buildUserContext(user) {
    const context = {};
    
    if (user.fullName) context.name = user.fullName;
    if (user.email) context.email = user.email;
    if (user.experienceLevel) context.experienceLevel = user.experienceLevel;
    if (user.preferredTrack) context.track = user.preferredTrack;
    if (user.skills && user.skills.length > 0) {
      context.skills = user.skills.slice(0, 10).join(', ');
    }
    if (user.educationLevel) context.education = user.educationLevel;
    
    // Parse experiences
    if (user.experiences && user.experiences.length > 0) {
      const experiences = user.experiences.slice(0, 3).map(exp => {
        try {
          return typeof exp === 'string' ? JSON.parse(exp) : exp;
        } catch {
          return { title: exp, description: '' };
        }
      }).filter(exp => exp.title || exp.description);
      
      if (experiences.length > 0) {
        context.experiences = experiences.map(exp => {
          const parts = [];
          if (exp.title) parts.push(exp.title);
          if (exp.description) parts.push(exp.description);
          return parts.join(': ');
        }).join('\n');
      }
    }
    
    if (user.careerInterests && user.careerInterests.length > 0) {
      context.careerInterests = user.careerInterests.join(', ');
    }
    
    return context;
  }

  /**
   * Build job context, only including fields that exist
   * @param {Object} job - Job object
   * @param {Array} similarJobs - Array of similar jobs for context
   * @returns {Object} Job context with only existing fields
   */
  buildJobContext(job, similarJobs = []) {
    const context = {};
    
    if (job.title) context.title = job.title;
    if (job.company) context.company = job.company;
    if (job.location) context.location = job.location;
    if (job.requiredSkills && job.requiredSkills.length > 0) {
      context.requiredSkills = job.requiredSkills.join(', ');
    }
    if (job.experienceLevel) context.experienceLevel = job.experienceLevel;
    if (job.jobType) context.jobType = job.jobType;
    if (job.track) context.track = job.track;
    
    // Add similar jobs context if available
    if (similarJobs.length > 0) {
      context.similarJobs = similarJobs.map(sj => {
        const parts = [];
        if (sj.title) parts.push(`Title: ${sj.title}`);
        if (sj.company) parts.push(`Company: ${sj.company}`);
        if (sj.requiredSkills && sj.requiredSkills.length > 0) {
          parts.push(`Skills: ${sj.requiredSkills.join(', ')}`);
        }
        return parts.join(', ');
      }).join('\n');
    }
    
    return context;
  }

  /**
   * Generate a personalized cover letter for a job application
   * 
   * @param {String} userId - User ID
   * @param {String} jobId - Job ID
   * @returns {Object} { coverLetter, subject }
   */
  async generateCoverLetter(userId, jobId) {
    try {
      const [user, job] = await Promise.all([
        User.findById(userId)
          .select('fullName email skills experienceLevel preferredTrack experiences educationLevel careerInterests address city state zip phone')
          .lean(),
        Job.findById(jobId).lean(),
      ]);

      if (!user) {
        throw new Error('User not found');
      }

      if (!job) {
        throw new Error('Job not found');
      }

      // Embed the job first for better analysis
      try {
        await jobMatchPercentageAgent.embedJob(job);
      } catch (error) {
        console.warn('Job embedding warning (non-critical):', error.message);
      }

      // Use embeddings to find similar jobs for better context
      const similarJobs = await this.findSimilarJobs(job);

      // Build contexts (only including existing fields)
      const userContext = this.buildUserContext(user);
      const jobContext = this.buildJobContext(job, similarJobs);

      // Find matching skills (only if both exist)
      let matchedSkills = [];
      if (user.skills && user.skills.length > 0 && job.requiredSkills && job.requiredSkills.length > 0) {
        matchedSkills = user.skills.filter(skill =>
          job.requiredSkills.some(
            reqSkill => skill.toLowerCase().includes(reqSkill.toLowerCase()) ||
                       reqSkill.toLowerCase().includes(skill.toLowerCase())
          )
        );
      }

      // Build prompt sections dynamically (only include existing fields)
      const candidateSections = [];
      if (userContext.name) candidateSections.push(`- Name: ${userContext.name}`);
      if (userContext.experienceLevel) candidateSections.push(`- Experience Level: ${userContext.experienceLevel}`);
      if (userContext.track) candidateSections.push(`- Career Track: ${userContext.track}`);
      if (userContext.skills) candidateSections.push(`- Key Skills: ${userContext.skills}`);
      if (userContext.education) candidateSections.push(`- Education: ${userContext.education}`);
      if (userContext.experiences) candidateSections.push(`- Relevant Experience:\n${userContext.experiences}`);
      if (userContext.careerInterests) candidateSections.push(`- Career Interests: ${userContext.careerInterests}`);

      const jobSections = [];
      if (jobContext.title) jobSections.push(`- Position: ${jobContext.title}`);
      if (jobContext.company) jobSections.push(`- Company: ${jobContext.company}`);
      if (jobContext.location) jobSections.push(`- Location: ${jobContext.location}`);
      if (jobContext.requiredSkills) jobSections.push(`- Required Skills: ${jobContext.requiredSkills}`);
      if (jobContext.experienceLevel) jobSections.push(`- Experience Level Required: ${jobContext.experienceLevel}`);
      if (jobContext.jobType) jobSections.push(`- Job Type: ${jobContext.jobType}`);
      if (jobContext.track) jobSections.push(`- Track: ${jobContext.track}`);
      
      // Add similar jobs context if available
      if (jobContext.similarJobs) {
        jobSections.push(`\nSimilar Industry Roles (for context):\n${jobContext.similarJobs}`);
      }

      const prompt = `You are an expert career coach and professional resume writer with 15+ years of experience helping candidates write compelling cover letters that get interviews.

TASK: Write a professional, personalized cover letter for a job application.

CANDIDATE PROFILE:
${candidateSections.join('\n')}

JOB OPPORTUNITY:
${jobSections.join('\n')}

${matchedSkills.length > 0 ? `MATCHING SKILLS: ${matchedSkills.slice(0, 5).join(', ')}` : 'Note: Focus on general alignment and eagerness to learn.'}

REQUIREMENTS:
1. Write a professional, engaging cover letter (3-4 paragraphs, 200-300 words)
2. Start with a strong opening that shows enthusiasm for the role
3. Highlight the candidate's relevant skills and experiences that match the job requirements
${matchedSkills.length > 0 ? `4. Mention specific matching skills: ${matchedSkills.slice(0, 5).join(', ')}` : '4. Emphasize transferable skills and eagerness to learn'}
5. Show knowledge of the company/role (be professional, not generic)
6. End with a strong closing expressing interest in an interview
7. Use professional but warm tone
8. Be specific and avoid generic phrases
9. Show how the candidate's background aligns with the job requirements
10. If candidate is a fresher, emphasize eagerness to learn and relevant education/projects
${jobContext.similarJobs ? '11. Use insights from similar industry roles to show understanding of the field' : ''}

FORMAT:
- Write ONLY the body paragraphs of the cover letter (3-4 paragraphs)
- Do NOT include any header information (no addresses, no dates, no "Dear Hiring Manager" - that will be added separately)
- Do NOT include any placeholder text like [Your Address], [Date], [Company Address], etc.
- Do NOT include signature or closing lines (those will be added separately)
- No markdown, just plain text
- Proper paragraph breaks between paragraphs
- Start directly with the first paragraph content

CRITICAL: Return ONLY the body paragraphs of the cover letter. Do NOT include:
- Sender's address
- Date
- Recipient's address
- Salutation (Dear Hiring Manager)
- Placeholder text of any kind
- Signature or closing lines

Just the body paragraphs that express interest and qualifications.`;

      let coverLetter = await aiService.generateContent(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });

      // Clean up any placeholder text that might have slipped through
      coverLetter = coverLetter
        .replace(/\[Your Address\]/gi, '')
        .replace(/\[Your Email\]/gi, '')
        .replace(/\[Your Phone Number\]/gi, '')
        .replace(/\[Your Phone\]/gi, '')
        .replace(/\[Date\]/gi, '')
        .replace(/\[Company Address\]/gi, '')
        .replace(/\[City, State, Zip\]/gi, '')
        .replace(/\[City, State, ZIP\]/gi, '')
        .replace(/\[.*?\]/g, '') // Remove any other bracket placeholders
        .replace(/Dear Hiring Manager,?/gi, '') // Remove salutation if included
        .replace(/Sincerely,?/gi, '')
        .replace(/Best regards,?/gi, '')
        .replace(/Respectfully,?/gi, '')
        .trim();

      // Remove multiple consecutive newlines
      coverLetter = coverLetter.replace(/\n{3,}/g, '\n\n');

      // Generate email subject (only include existing fields)
      const subjectParts = [];
      if (jobContext.title) subjectParts.push(`Position: ${jobContext.title}`);
      if (jobContext.company) subjectParts.push(`Company: ${jobContext.company}`);
      if (userContext.name) subjectParts.push(`Candidate: ${userContext.name}`);
      
      const subjectPrompt = `Generate a professional email subject line for a job application.
${subjectParts.join('\n')}

Return ONLY the subject line, nothing else.`;

      const subject = await aiService.generateContent(subjectPrompt, {
        temperature: 0.5,
        maxTokens: 50,
      });

      // Build fallback subject (only include existing fields)
      let fallbackSubject = 'Job Application';
      if (jobContext.title && jobContext.company) {
        fallbackSubject = `Job Application: ${jobContext.title} at ${jobContext.company}`;
      } else if (jobContext.title) {
        fallbackSubject = `Job Application: ${jobContext.title}`;
      } else if (jobContext.company) {
        fallbackSubject = `Job Application at ${jobContext.company}`;
      }

      return {
        coverLetter: coverLetter.trim(),
        subject: subject.trim() || fallbackSubject,
      };
    } catch (error) {
      console.error('Cover letter generation error:', error);
      throw new Error(`Failed to generate cover letter: ${error.message}`);
    }
  }
}

module.exports = new JobApplicationAgent();

