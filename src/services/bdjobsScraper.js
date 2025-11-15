const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const Job = require('../models/Job');
const cvExtractionAgent = require('../agents/cvExtractionAgent');

/**
 * Bdjobs.com Web Scraper
 * Scrapes job listings from bdjobs.com and stores them in database
 */
class BdjobsScraper {
  constructor() {
    this.baseUrl = 'https://bdjobs.com';
    this.maxJobsPerCategory = 20; // Limit to avoid overwhelming the system
  }

  /**
   * Map bdjobs category to our track system
   */
  mapCategoryToTrack(category) {
    const categoryMap = {
      'IT & Telecommunication': 'Web Development',
      'Engineer/Architects': 'Backend Development',
      'Design/Creative': 'Design',
      'Marketing/Sales': 'Digital Marketing',
      'Data Entry/Computer Operator': 'Data Science',
      'Education/Training': 'Education',
      'Healthcare/Medical': 'Healthcare',
      'Bank/Non-Bank Fin. Institution': 'Finance',
      'Accounting/Finance': 'Finance',
      'HR/Org. Development': 'Human Resources',
      'Media/Ad./Event Mgt.': 'Content Creation',
      'Garments/Textile': 'Manufacturing',
      'Production/Operation': 'Manufacturing',
      'Hospitality/ Travel/ Tourism': 'Hospitality',
      'Commercial': 'Sales',
      'Customer Service/Call Centre': 'Customer Service',
      'Pharmaceutical': 'Healthcare',
      'NGO/Development': 'NGO',
      'Research/Consultancy': 'Research',
    };

    if (!category) return 'General';

    // Try exact match first
    if (categoryMap[category]) {
      return categoryMap[category];
    }

    // Try partial match
    for (const [key, value] of Object.entries(categoryMap)) {
      if (category.includes(key) || key.includes(category)) {
        return value;
      }
    }

    // Default fallback
    return 'General';
  }

  /**
   * Map bdjobs experience level to our format
   */
  mapExperienceLevel(level) {
    if (!level) return 'Fresher';

    const levelLower = level.toLowerCase();
    
    if (levelLower.includes('fresher') || levelLower.includes('entry')) {
      return 'Fresher';
    }
    if (levelLower.includes('junior') || levelLower.includes('associate')) {
      return 'Junior';
    }
    if (levelLower.includes('mid') || levelLower.includes('senior') || levelLower.includes('executive')) {
      return 'Mid';
    }

    return 'Fresher';
  }

  /**
   * Map bdjobs job type to our format
   */
  mapJobType(type) {
    if (!type) return 'Full-time';

    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('full') || typeLower.includes('permanent')) {
      return 'Full-time';
    }
    if (typeLower.includes('part')) {
      return 'Part-time';
    }
    if (typeLower.includes('intern')) {
      return 'Internship';
    }
    if (typeLower.includes('freelance') || typeLower.includes('contract')) {
      return 'Freelance';
    }

    return 'Full-time';
  }

  /**
   * Extract skills from job description using AI agent
   */
  async extractSkillsFromDescription(description) {
    try {
      if (!description || description.length < 50) {
        return [];
      }

      // Use existing CV extraction agent to extract skills
      const extracted = await cvExtractionAgent.extractSkillsFromCV(
        description,
        null // No preferred track, let AI determine
      );

      return extracted.skills || [];
    } catch (error) {
      console.error('Error extracting skills:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Extract email from text
   */
  extractEmail(text) {
    if (!text) return '';
    
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const matches = text.match(emailRegex);
    
    if (matches && matches.length > 0) {
      // Filter out common non-email patterns
      const validEmail = matches.find(email => 
        !email.includes('example.com') && 
        !email.includes('test.com') &&
        email.includes('.')
      );
      return validEmail || matches[0];
    }
    
    return '';
  }

  /**
   * Scrape job listings from bdjobs.com
   */
  async scrapeJobs(maxJobs = 50) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const scrapedJobs = [];
    const seenJobIds = new Set();

    try {
      const page = await browser.newPage();
      
      // Set user agent to avoid blocking
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to bdjobs.com jobs page
      console.log('🌐 Navigating to bdjobs.com...');
      await page.goto(`${this.baseUrl}/jobs`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(3000);

      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);

      console.log('📄 Page loaded, searching for job listings...');

      // Try multiple selectors that bdjobs.com might use
      const jobSelectors = [
        '.job-summary',
        '.job-item',
        '.job-card',
        '[class*="job"]',
        '.single-job-post',
        '.job-list-item',
        'article.job',
        '.job-listing',
      ];

      let jobElements = [];
      for (const selector of jobSelectors) {
        jobElements = $(selector);
        if (jobElements.length > 0) {
          console.log(`✅ Found ${jobElements.length} jobs using selector: ${selector}`);
          break;
        }
      }

      if (jobElements.length === 0) {
        // Fallback: look for any links that might be job listings
        console.log('⚠️  No jobs found with standard selectors, trying alternative approach...');
        jobElements = $('a[href*="/job/"], a[href*="/jobs/"]').parent();
      }

      let processedCount = 0;

      for (let i = 0; i < Math.min(jobElements.length, maxJobs); i++) {
        if (scrapedJobs.length >= maxJobs) break;

        try {
          const element = jobElements[i];
          const $el = $(element);

          // Extract job data - try multiple possible selectors
          const title = $el.find('.job-title, h3, h4, h2, [class*="title"], a').first().text().trim();
          const company = $el.find('.company-name, .company, [class*="company"]').first().text().trim();
          const location = $el.find('.location, [class*="location"], [class*="city"]').first().text().trim() || 'Dhaka, Bangladesh';
          const category = $el.find('.category, [class*="category"], [class*="industry"]').first().text().trim();
          const jobType = $el.find('.job-type, [class*="type"], [class*="employment"]').first().text().trim();
          const experienceLevel = $el.find('.experience, [class*="experience"], [class*="level"]').first().text().trim();
          const description = $el.find('.description, [class*="description"], .job-desc, .summary').first().text().trim();
          
          // Try to find job link
          let jobLink = $el.find('a').first().attr('href');
          if (jobLink && !jobLink.startsWith('http')) {
            jobLink = `${this.baseUrl}${jobLink}`;
          }

          // Skip if essential fields are missing
          if (!title || !company || title.length < 5) {
            continue;
          }

          // Create unique ID from title + company
          const jobId = `${title}_${company}`.toLowerCase().replace(/\s+/g, '_').substring(0, 100);

          // Skip if already seen
          if (seenJobIds.has(jobId)) {
            continue;
          }

          seenJobIds.add(jobId);

          // Map to our format
          const track = this.mapCategoryToTrack(category);
          const mappedExperienceLevel = this.mapExperienceLevel(experienceLevel);
          const mappedJobType = this.mapJobType(jobType);

          // Extract email from description or try to get from job page
          let email = this.extractEmail(description);
          
          // If no email found and we have a job link, try to fetch the job page
          if (!email && jobLink) {
            try {
              const jobPage = await browser.newPage();
              await jobPage.goto(jobLink, {
                waitUntil: 'networkidle2',
                timeout: 10000,
              });
              
              await jobPage.waitForTimeout(2000);
              
              const jobPageContent = await jobPage.content();
              const $jobPage = cheerio.load(jobPageContent);
              
              // Try to find email in job page
              const pageText = $jobPage.text();
              email = this.extractEmail(pageText);
              
              // Also try to get full description from job page
              const fullDescription = $jobPage.find('.job-description, [class*="description"], .details').text() || description;
              
              await jobPage.close();
              
              // Use full description for skill extraction if available
              if (fullDescription.length > description.length) {
                description = fullDescription;
              }
            } catch (err) {
              console.warn(`Could not fetch job page for: ${title}`);
            }
          }

          // Extract skills from description (with timeout to avoid blocking)
          let skills = [];
          try {
            skills = await Promise.race([
              this.extractSkillsFromDescription(description),
              new Promise((resolve) => setTimeout(() => resolve([]), 5000)), // 5 second timeout
            ]);
          } catch (err) {
            console.warn(`Could not extract skills for: ${title}`);
          }

          scrapedJobs.push({
            title: title.substring(0, 200), // Limit title length
            company: company.substring(0, 100), // Limit company length
            location: location.substring(0, 100) || 'Dhaka, Bangladesh',
            requiredSkills: skills.length > 0 ? skills.slice(0, 10) : ['See job description'], // Limit to 10 skills
            experienceLevel: mappedExperienceLevel,
            jobType: mappedJobType,
            track,
            email: email || 'hr@company.com', // Default email if not found
            source: 'bdjobs.com',
            sourceUrl: jobLink || '',
          });

          processedCount++;
          
          // Add small delay to avoid overwhelming the server
          if (processedCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error processing job ${i}:`, error.message);
        }
      }

      await browser.close();
      console.log(`✅ Successfully scraped ${scrapedJobs.length} jobs`);
      return scrapedJobs;
    } catch (error) {
      console.error('❌ Error scraping bdjobs.com:', error);
      await browser.close();
      throw error;
    }
  }

  /**
   * Save scraped jobs to database (avoid duplicates)
   */
  async saveJobsToDatabase(jobs) {
    const savedJobs = [];
    const skippedJobs = [];

    for (const jobData of jobs) {
      try {
        // Check if job already exists (by title + company)
        const existingJob = await Job.findOne({
          title: jobData.title,
          company: jobData.company,
          source: 'bdjobs.com',
        });

        if (existingJob) {
          skippedJobs.push(jobData.title);
          continue;
        }

        // Create new job
        const job = await Job.create(jobData);
        savedJobs.push(job);
      } catch (error) {
        console.error(`Error saving job ${jobData.title}:`, error.message);
        skippedJobs.push(jobData.title);
      }
    }

    return {
      saved: savedJobs.length,
      skipped: skippedJobs.length,
      jobs: savedJobs,
    };
  }

  /**
   * Main method to scrape and save jobs
   */
  async scrapeAndSave(maxJobs = 50) {
    try {
      console.log('🚀 Starting bdjobs.com scraping...');
      console.log(`📊 Target: ${maxJobs} jobs`);
      
      const scrapedJobs = await this.scrapeJobs(maxJobs);
      console.log(`📊 Scraped ${scrapedJobs.length} jobs from bdjobs.com`);

      if (scrapedJobs.length === 0) {
        return {
          saved: 0,
          skipped: 0,
          jobs: [],
          message: 'No jobs found. The website structure may have changed or selectors need updating.',
        };
      }

      const result = await this.saveJobsToDatabase(scrapedJobs);
      console.log(`✅ Saved ${result.saved} new jobs, skipped ${result.skipped} duplicates`);

      return {
        ...result,
        message: `Successfully scraped and saved ${result.saved} new jobs from bdjobs.com`,
      };
    } catch (error) {
      console.error('❌ Error in scrapeAndSave:', error);
      throw new Error(`Failed to scrape jobs: ${error.message}`);
    }
  }
}

module.exports = new BdjobsScraper();

