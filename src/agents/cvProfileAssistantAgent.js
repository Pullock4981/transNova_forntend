const aiService = require('../services/aiService');
const User = require('../models/User');

/**
 * CV / Profile Assistant Agent
 *
 * Purpose: Helps users create professional CVs and improve their online presence.
 *
 * Responsibilities:
 * - Generate professional summaries from user profile data
 * - Suggest strong bullet points for projects/experience
 * - Provide LinkedIn and portfolio improvement recommendations
 * - Generate clean CV layouts (text format for PDF export)
 * - Use AI to enhance profile descriptions
 *
 * Usage:
 *   const agent = require('./agents/cvProfileAssistantAgent');
 *   const summary = await agent.generateProfessionalSummary(userId);
 *   const bullets = await agent.suggestBulletPoints(userId, experience);
 *   const recommendations = await agent.getLinkedInRecommendations(userId);
 *   const cvText = await agent.generateCVLayout(userId);
 */
class CVProfileAssistantAgent {
  /**
   * Generates a professional summary based on user profile.
   *
   * @param {String} userId - The ID of the user.
   * @returns {Object} Professional summary and suggestions.
   */
  async generateProfessionalSummary(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Parse experiences for context
    let experiencesData = [];
    try {
      if (user.experiences && user.experiences.length > 0) {
        experiencesData = user.experiences.map(exp => {
          const parsed = typeof exp === 'string' ? JSON.parse(exp) : exp;
          return {
            title: parsed.title || parsed.role || 'Project',
            description: parsed.description || '',
            technologies: parsed.technologies || [],
          };
        });
      }
    } catch (e) {
      // If parsing fails, use empty array
    }

    const topSkills = (user.skills || []).slice(0, 6).join(', ');
    const experienceLevel = user.experienceLevel || 'Fresher';
    const track = user.preferredTrack || 'your field';
    const projectCount = experiencesData.length;
    const keyProjects = experiencesData.slice(0, 2).map(e => e.title).join(', ');

    // Get more context for better summary
    const allSkills = user.skills || [];
    const skillCategories = this.categorizeSkills(allSkills);
    const totalExperienceMonths = this.calculateTotalExperience(user.experiences || []);
    const experienceYears = Math.floor(totalExperienceMonths / 12);
    const experienceMonths = totalExperienceMonths % 12;
    const experienceText = experienceYears > 0 
      ? `${experienceYears} year${experienceYears > 1 ? 's' : ''}${experienceMonths > 0 ? ` ${experienceMonths} month${experienceMonths > 1 ? 's' : ''}` : ''}`
      : experienceMonths > 0 ? `${experienceMonths} month${experienceMonths > 1 ? 's' : ''}` : '';

    const prompt = `You are a C-level executive resume writer and career strategist with 20+ years of experience crafting executive summaries for Fortune 500 CTOs, VPs of Engineering, and senior technical leaders at Google, Microsoft, Amazon, and Meta. Create a WORLD-CLASS, EXECUTIVE-LEVEL professional summary that immediately positions the candidate as a top-tier professional.

CANDIDATE PROFILE ANALYSIS:
- Full Name: ${user.fullName || 'Professional'}
- Career Track/Specialization: ${track}
- Experience Level: ${experienceLevel}${experienceText ? ` (${experienceText} of experience)` : ''}
- Education: ${user.educationLevel || 'Not specified'}
- Core Technical Skills: ${topSkills || 'To be developed'}
- Skill Categories: ${Object.keys(skillCategories).filter(k => skillCategories[k].length > 0).map(k => `${k}: ${skillCategories[k].slice(0, 3).join(', ')}`).join('; ') || 'Various technical skills'}
- Career Interests: ${(user.careerInterests || []).join(', ') || 'Not specified'}
- Project Portfolio: ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}${keyProjects ? ` (Notable: ${keyProjects})` : ''}

EXECUTIVE SUMMARY FRAMEWORK (Create 3-4 sentences, 120-160 words):

1. POWERFUL OPENING STATEMENT (First sentence - 25-35 words):
   - Lead with ${experienceLevel === 'Fresher' ? 'aspirational positioning' : 'years of experience or key achievement'}
   - Include exact role/title: "${track} ${experienceLevel === 'Fresher' ? 'Professional' : experienceLevel === 'Junior' ? 'Developer' : 'Engineer'}"
   - Mention ${topSkills ? `top 2-3 core technologies: ${allSkills.slice(0, 3).join(', ')}` : 'technical expertise'}
   - Use executive-level action verbs: "Architect", "Engineer", "Spearhead", "Pioneer", "Transform"
   - Example: "${experienceLevel === 'Fresher' ? 'Aspiring' : 'Experienced'} ${track} ${experienceLevel === 'Fresher' ? 'professional' : 'engineer'} specializing in ${allSkills.slice(0, 2).join(' and ')}${experienceText ? ` with ${experienceText} of hands-on experience` : ''}"

2. TECHNICAL EXPERTISE & ACHIEVEMENTS (Second sentence - 30-40 words):
   - Highlight technical depth: ${skillCategories['Programming Languages']?.slice(0, 2).join(', ') || topSkills}
   - Mention ${projectCount > 0 ? `${projectCount} project${projectCount !== 1 ? 's' : ''} demonstrating` : 'demonstrated'} technical proficiency
   - Include quantifiable achievements if available (performance improvements, scalability, user impact)
   - Show problem-solving and technical innovation
   - Reference ${track} best practices and industry standards

3. VALUE PROPOSITION & DIFFERENTIATION (Third sentence - 30-40 words):
   - Emphasize unique value: ${(user.careerInterests || []).length > 0 ? `passion for ${user.careerInterests[0]}` : `commitment to ${track}`}
   - Highlight specialization or niche expertise in ${track}
   - Show strategic thinking and business impact awareness
   - Position as ${experienceLevel === 'Fresher' ? 'high-potential talent with rapid learning ability' : 'proven contributor who drives results'}

4. FORWARD-LOOKING CLOSING (Fourth sentence - 25-35 words):
   - Express career aspirations aligned with ${track}
   - Use confident, forward-looking language
   - Show eagerness to contribute to innovative projects
   - Maintain executive-level professionalism

WRITING EXCELLENCE STANDARDS:
- Executive Language: Use sophisticated, confident terminology appropriate for senior roles
- ATS Optimization: Strategic keyword placement ('${track}', '${allSkills[0] || 'technical'}', '${allSkills[1] || 'development'}') with 2-3% density
- Quantification: Include specific metrics, numbers, or impact statements when possible
- Industry Terminology: Use ${track}-specific jargon and technical terms correctly
- Cliché Elimination: Avoid "team player", "hard worker", "passionate" - use specific achievements instead
- Conciseness: Every word must add value - no filler language
- Impact Focus: Emphasize results, outcomes, and business value over tasks
- Professional Tone: Confident, authoritative, yet approachable

Return ONLY a JSON object with this structure:
{
  "summary": "Executive-level professional summary (3-4 sentences, 120-160 words, ATS-optimized)",
  "suggestions": [
    "Strategic improvement suggestion 1 with specific, actionable guidance",
    "Strategic improvement suggestion 2 with industry best practices"
  ],
  "keywords": ["${track}", "${allSkills[0] || 'technical'}", "${allSkills[1] || 'development'}", "${allSkills[2] || 'expertise'}", "${allSkills[3] || 'solutions'}"]
}

CRITICAL REQUIREMENTS:
- The summary must read like it was written for a CTO or VP of Engineering position
- Every sentence must demonstrate value and expertise
- Must pass ATS systems while remaining human-readable and compelling
- Should make hiring managers think "I need to interview this person immediately"`;

    try {
      const result = await aiService.generateStructuredJSON(prompt, {
        summary: 'string',
        suggestions: 'array',
        keywords: 'array',
      });

      return {
        summary: result.summary || this.generateFallbackSummary(user),
        suggestions: result.suggestions || [],
        keywords: result.keywords || [],
      };
    } catch (error) {
      console.error('Professional Summary Generation Error:', error);
      return {
        summary: this.generateFallbackSummary(user),
        suggestions: [
          `Enhance your summary with specific achievements and quantifiable results from your ${projectCount} project${projectCount !== 1 ? 's' : ''} to demonstrate impact and value to potential employers`,
          `Incorporate industry-specific keywords like '${track}', '${user.skills?.[0] || 'key skills'}' more strategically throughout the summary to improve ATS matching and recruiter search visibility`,
          `Strengthen your value proposition by highlighting unique differentiators, technical expertise in ${topSkills}, and how your ${experienceLevel === 'Fresher' ? 'learning agility and' : 'proven track record and'} passion for ${track} align with employer needs`,
        ],
        keywords: user.skills?.slice(0, 5) || [],
      };
    }
  }

  /**
   * Suggests strong bullet points for experiences/projects.
   *
   * @param {String} userId - The ID of the user.
   * @param {Object} experience - Experience or project object (optional, uses user's experiences if not provided).
   * @returns {Object} Suggested bullet points.
   */
  async suggestBulletPoints(userId, experience = null) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const experiences = experience ? [experience] : (user.experiences || []);

    if (experiences.length === 0) {
      return {
        suggestions: [],
        message: 'No experiences found. Add projects or work experiences to your profile first.',
      };
    }

    const experienceToEnhance = experiences[0]; // Focus on first experience or provided one

    // Get user context for better bullet points
    const userTrack = user.preferredTrack || 'your field';
    const userSkills = (user.skills || []).slice(0, 5).join(', ');

    // Get more context for bullet points
    const allUserSkills = user.skills || [];
    const projectTech = experienceToEnhance.technologies || [];
    const matchingSkills = allUserSkills.filter(s => 
      projectTech.some(t => t.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(t.toLowerCase()))
    );

    const prompt = `You are a C-level executive resume writer with expertise crafting bullet points for Fortune 500 technical leaders. Transform this experience into WORLD-CLASS, EXECUTIVE-LEVEL bullet points that demonstrate strategic thinking, technical excellence, and measurable business impact.

EXPERIENCE/PROJECT ANALYSIS:
- Title/Role: ${experienceToEnhance.title || experienceToEnhance.role || 'Project'}
- Description: ${experienceToEnhance.description || 'No description provided'}
- Technologies Used: ${projectTech.length > 0 ? projectTech.join(', ') : 'Not specified'}
- Duration: ${experienceToEnhance.duration || 'Not specified'}
- Career Context: ${userTrack} professional (${user.experienceLevel || 'Fresher'}) with expertise in ${userSkills}
- Matching Skills: ${matchingSkills.length > 0 ? matchingSkills.join(', ') : 'Various technical skills'}

EXECUTIVE BULLET POINT FRAMEWORK (Generate 4-6 bullet points):

1. POWERFUL ACTION VERBS (Choose from executive-level verbs):
   - Strategic: Architected, Engineered, Spearheaded, Pioneered, Transformed, Orchestrated
   - Technical: Implemented, Optimized, Developed, Designed, Built, Integrated
   - Leadership: Led, Directed, Coordinated, Mentored, Collaborated, Delivered

2. STRUCTURE (CAR/STAR Method):
   - Challenge/Context: Brief problem statement or business need
   - Action: Specific technical approach using ${projectTech.length > 0 ? projectTech.slice(0, 3).join(', ') : 'relevant technologies'}
   - Result: Quantifiable impact with metrics (performance, scalability, user growth, cost savings, time reduction)

3. QUANTIFICATION EXCELLENCE:
   - Primary Metrics: Performance improvements (X% faster, Xms reduction), scalability (X users, X requests/sec), efficiency (X% cost reduction, X hours saved)
   - Secondary Metrics: Code quality (X lines, X% test coverage), features (X features delivered), user impact (X users, X% satisfaction)
   - For ${user.experienceLevel === 'Fresher' ? 'entry-level' : 'mid-level'} projects: Estimate realistic metrics based on project scope
   - Use ranges if exact numbers unavailable: "approximately X", "over X", "X+", "up to X"

4. TECHNICAL SOPHISTICATION:
   - Mention specific technologies: ${projectTech.length > 0 ? projectTech.slice(0, 4).join(', ') : 'modern tech stack'}
   - Highlight architecture decisions, design patterns, or technical innovations
   - Show understanding of ${userTrack} best practices and industry standards
   - Demonstrate problem-solving approach and technical depth

5. BUSINESS IMPACT & VALUE:
   - Connect technical work to business outcomes
   - Show how the project contributed to larger organizational goals
   - Highlight unique contributions, innovations, or optimizations
   - Demonstrate strategic thinking beyond just coding

6. ATS & KEYWORD OPTIMIZATION:
   - Naturally integrate keywords: ${userSkills}
   - Use ${userTrack}-specific terminology correctly
   - Include technology names: ${projectTech.length > 0 ? projectTech.slice(0, 3).join(', ') : 'relevant technologies'}
   - Maintain readability while optimizing for ATS

EXAMPLE FORMATS (Executive-Level):
- "Architected and engineered [solution] using [technologies] to [solve problem], resulting in [quantifiable metric] and [business impact]"
- "Spearheaded development of [what] leveraging [technologies], improving [metric] by [percentage] and [additional benefit]"
- "Optimized [system/process] through [technical approach], reducing [metric] by [amount] and enhancing [outcome]"
- "Led cross-functional team to implement [solution] using [technologies], delivering [outcome] that [business impact]"

Return ONLY a JSON object with this structure:
{
  "bulletPoints": [
    "Executive-level bullet point 1 with powerful verb, specific technologies, and quantifiable impact",
    "Executive-level bullet point 2 with technical depth and business value",
    "Executive-level bullet point 3 with metrics and strategic context",
    "Executive-level bullet point 4"
  ],
  "improvements": [
    "Strategic improvement suggestion 1 with specific, actionable guidance",
    "Strategic improvement suggestion 2 with industry best practices"
  ]
}

CRITICAL REQUIREMENTS:
- Each bullet point must be 1-2 lines maximum, start with executive-level action verb
- Must include specific technologies: ${projectTech.length > 0 ? projectTech.slice(0, 2).join(', ') : 'relevant tech'}
- Must quantify impact with metrics (even if estimated for ${user.experienceLevel === 'Fresher' ? 'entry-level' : 'mid-level'} projects)
- Must demonstrate strategic thinking and business value, not just technical tasks
- Must be ATS-optimized while remaining compelling to human readers
- Should read like it belongs on a CTO or VP of Engineering resume`;

    try {
      const result = await aiService.generateStructuredJSON(prompt, {
        bulletPoints: 'array',
        improvements: 'array',
      });

      return {
        bulletPoints: result.bulletPoints || this.generateFallbackBullets(experienceToEnhance),
        improvements: result.improvements || [],
      };
    } catch (error) {
      console.error('Bullet Points Generation Error:', error);
      return {
        bulletPoints: this.generateFallbackBullets(experienceToEnhance),
        improvements: [
          'Add specific technologies used',
          'Include measurable outcomes or achievements',
          'Use stronger action verbs',
        ],
      };
    }
  }

  /**
   * Provides LinkedIn and portfolio improvement recommendations.
   *
   * @param {String} userId - The ID of the user.
   * @returns {Object} Recommendations for LinkedIn and portfolio.
   */
  async getLinkedInRecommendations(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Parse experiences for better context
    let experiencesData = [];
    try {
      if (user.experiences && user.experiences.length > 0) {
        experiencesData = user.experiences.map(exp => {
          const parsed = typeof exp === 'string' ? JSON.parse(exp) : exp;
          return {
            title: parsed.title || parsed.role || 'Project',
            description: parsed.description || '',
            technologies: parsed.technologies || [],
          };
        });
      }
    } catch (e) {
      // If parsing fails, use empty array
    }

    const topSkills = (user.skills || []).slice(0, 8).join(', ');
    const experienceLevel = user.experienceLevel || 'Fresher';
    const track = user.preferredTrack || 'your field';
    const projectCount = experiencesData.length;
    const sampleProjects = experiencesData.slice(0, 3).map(e => e.title).join(', ');

    const prompt = `You are a senior career strategist and executive recruiter with 15+ years of experience optimizing professional profiles for Fortune 500 companies and top tech firms. You specialize in helping ${track} professionals build compelling personal brands that attract recruiters and hiring managers.

Provide PROFESSIONAL-GRADE, STRATEGIC, and DATA-DRIVEN recommendations that reflect industry best practices used by top recruiters and career coaches.

USER PROFILE ANALYSIS:
- Career Track: ${track}
- Experience Level: ${experienceLevel}
- Core Technical Skills: ${topSkills || 'To be developed'}
- Career Interests: ${(user.careerInterests || []).join(', ') || 'Not specified'}
- Education: ${user.educationLevel || 'Not specified'}
- Project Portfolio: ${projectCount} ${projectCount === 1 ? 'project' : 'projects'} documented
${sampleProjects ? `- Notable Projects: ${sampleProjects}` : ''}

PROFESSIONAL STANDARDS REQUIRED:
Your recommendations must:
1. Reflect current 2024 hiring trends and ATS (Applicant Tracking System) optimization
2. Include specific, measurable metrics and industry benchmarks
3. Provide strategic insights, not just tactical tips
4. Reference proven frameworks (e.g., STAR method, personal branding frameworks)
5. Address both immediate improvements and long-term career positioning
6. Consider the competitive landscape in ${track}
7. Use professional terminology and industry-standard language
8. Provide actionable next steps with clear priorities

LINKEDIN PROFILE OPTIMIZATION (Provide 6-7 professional recommendations):
Structure your recommendations as strategic guidance:

1. HEADLINE OPTIMIZATION (Critical - First Impression):
   - Provide 2-3 professionally crafted headline examples that:
     * Include target role/title, core competencies (${topSkills}), and value proposition
     * Optimize for ATS keyword matching and recruiter search algorithms
     * Balance professionalism with personality
     * Example format: "[Role] | [Top 2-3 Skills] | [Differentiator]"
   - Explain the psychology behind effective headlines (120-character optimization)
   - Reference LinkedIn's algorithm preferences

2. ABOUT/SUMMARY SECTION (Personal Brand Narrative):
   - Provide a strategic framework for the summary structure:
     * Hook (first 2 lines - must be compelling)
     * Value proposition paragraph (skills, experience, achievements)
     * Career narrative and passion for ${track}
     * Call-to-action (what you're seeking)
   - Include example opening lines tailored to ${experienceLevel} level
   - Specify optimal length (2,000 characters), keyword density, and readability
   - Explain how to balance storytelling with keyword optimization for ATS

3. SKILLS & ENDORSEMENTS (Credibility Building):
   - Strategic skill prioritization: Which of their skills (${topSkills}) to feature first
   - Optimal number of skills (industry research shows 15-20 is optimal)
   - Endorsement strategy: How to systematically build endorsements
   - Skills hierarchy: Core technical skills vs. soft skills placement
   - Industry-specific skills for ${track} that they should consider adding

4. EXPERIENCE/PROJECT DESCRIPTIONS (Achievement Showcase):
   - Professional writing framework: Use CAR (Challenge-Action-Result) or STAR method
   - Quantification strategy: How to add metrics even for ${experienceLevel === 'Fresher' ? 'entry-level' : 'mid-level'} projects
   - Technology stack presentation: How to highlight ${topSkills} effectively
   - Formatting best practices: Bullet points, action verbs, impact statements
   - ATS optimization: Keyword placement and density

5. PROFILE COMPLETENESS & OPTIMIZATION:
   - LinkedIn's "All-Star" profile requirements
   - Profile strength score optimization
   - Background banner customization for ${track} professionals
   - Professional photo guidelines (industry standards)
   - Education and certification presentation

6. KEYWORD STRATEGY & SEO:
   - Industry-specific keywords for ${track} roles
   - ATS keyword optimization: Where to place keywords (headline, summary, experience)
   - Search ranking factors: How LinkedIn's algorithm ranks profiles
   - Recruiter search behavior: What terms recruiters use to find ${track} talent

7. NETWORKING & ENGAGEMENT STRATEGY:
   - Connection strategy: Who to connect with, personalized connection requests
   - Content strategy: What to post/share to establish thought leadership in ${track}
   - Engagement tactics: Commenting, sharing, and building relationships
   - Industry group participation: Relevant groups for ${track} professionals

PORTFOLIO WEBSITE OPTIMIZATION (Provide 6-7 professional recommendations):

1. PROJECT SHOWCASE STRATEGY:
   - Portfolio curation: Which ${projectCount || 'projects'} to feature and why
   - Project presentation framework:
     * Problem statement and business context
     * Technical approach and architecture decisions
     * Technologies used (${topSkills}) with rationale
     * Challenges overcome and solutions implemented
     * Quantifiable results and impact metrics
     * Code quality indicators (GitHub links, live demos)
   - Visual presentation: Screenshots, GIFs, video walkthroughs
   - Case study format: How to structure each project as a compelling case study

2. TECHNICAL PORTFOLIO STRUCTURE:
   - Information architecture: Optimal site structure for ${track} portfolios
   - Navigation design: User experience best practices for recruiter navigation
   - Technology stack showcase: How to prominently display ${topSkills}
   - Code repository integration: GitHub presentation and README optimization

3. DESIGN & USER EXPERIENCE:
   - Professional design principles: Typography, spacing, color psychology
   - Responsive design: Mobile-first approach (60%+ of recruiters view on mobile)
   - Performance optimization: Page load speed (target: <3 seconds), Core Web Vitals
   - Accessibility standards: WCAG compliance for inclusive design

4. CONTENT STRATEGY:
   - About/Bio section: Professional narrative that complements LinkedIn
   - Skills section: Visual representation of ${topSkills} and proficiency levels
   - Blog/Articles section: Content strategy for thought leadership
   - Testimonials/Recommendations: Social proof integration

5. CALL-TO-ACTION OPTIMIZATION:
   - Strategic CTA placement: Conversion optimization principles
   - Contact form design: Best practices for recruiter outreach
   - Social proof: GitHub stars, project metrics, testimonials
   - Clear value proposition: What makes them stand out in ${track}

6. SEO & DISCOVERABILITY:
   - Technical SEO: Meta tags, structured data, sitemap
   - Content SEO: Keyword optimization for "${track} developer", "${track} portfolio"
   - Backlink strategy: How to get featured on portfolio showcase sites
   - Google Search Console setup and optimization

7. ANALYTICS & ITERATION:
   - Tracking setup: Google Analytics, heatmaps, user behavior
   - A/B testing: What to test and measure
   - Conversion tracking: How to measure portfolio effectiveness
   - Continuous improvement framework

GENERAL ONLINE PRESENCE STRATEGY (Provide 4-5 strategic recommendations):

1. CROSS-PLATFORM CONSISTENCY:
   - Brand alignment: Consistent messaging across LinkedIn, portfolio, GitHub
   - Visual identity: Professional photo, color scheme, tone of voice
   - Content synchronization: How to repurpose content across platforms

2. KEYWORD OPTIMIZATION ACROSS ECOSYSTEM:
   - Strategic keyword mapping: Core keywords for ${track} roles
   - Platform-specific optimization: LinkedIn vs. portfolio vs. GitHub
   - Long-tail keyword strategy: Niche positioning in ${track}

3. CONTENT MARKETING STRATEGY:
   - Thought leadership: What topics to write about in ${track}
   - Publishing cadence: Optimal posting frequency
   - Content formats: Articles, posts, code examples, tutorials
   - Engagement metrics: What to track and optimize

4. NETWORKING & COMMUNITY ENGAGEMENT:
   - Industry community participation: Relevant forums, Slack groups, Discord servers
   - Open source contributions: How to build reputation in ${track} community
   - Conference and event participation: Virtual and in-person networking
   - Mentorship: Both seeking and providing mentorship

5. PERSONAL BRAND POSITIONING:
   - Unique value proposition: What differentiates them in ${track}
   - Niche specialization: How to position as an expert
   - Long-term brand building: Strategic career positioning

Return ONLY a JSON object with this structure:
{
  "linkedInRecommendations": [
    "Professional recommendation 1 with strategic insight, specific example, and data/metrics",
    "Professional recommendation 2 with industry best practice and actionable framework",
    "Professional recommendation 3",
    "Professional recommendation 4",
    "Professional recommendation 5",
    "Professional recommendation 6"
  ],
  "portfolioRecommendations": [
    "Professional portfolio recommendation 1 with strategic framework and best practices",
    "Professional portfolio recommendation 2",
    "Professional portfolio recommendation 3",
    "Professional portfolio recommendation 4",
    "Professional portfolio recommendation 5",
    "Professional portfolio recommendation 6"
  ],
  "generalTips": [
    "Strategic tip 1 with industry insight and actionable guidance",
    "Strategic tip 2",
    "Strategic tip 3",
    "Strategic tip 4"
  ]
}

CRITICAL REQUIREMENTS:
- Each recommendation must be 3-4 sentences with professional depth
- Include specific frameworks, methodologies, or industry standards
- Reference data, metrics, or research when relevant
- Use professional terminology appropriate for executive-level career advice
- Provide strategic context, not just tactical tips
- Make recommendations immediately actionable with clear next steps
- Personalize to ${track} industry and ${experienceLevel} level
- Write in a confident, authoritative, professional tone`;

    try {
      const result = await aiService.generateStructuredJSON(prompt, {
        linkedInRecommendations: 'array',
        portfolioRecommendations: 'array',
        generalTips: 'array',
      });

      return {
        linkedInRecommendations: result.linkedInRecommendations || this.getFallbackLinkedInTips(user),
        portfolioRecommendations: result.portfolioRecommendations || this.getFallbackPortfolioTips(user),
        generalTips: result.generalTips || this.getFallbackGeneralTips(user),
      };
    } catch (error) {
      console.error('LinkedIn Recommendations Error:', error);
      return {
        linkedInRecommendations: this.getFallbackLinkedInTips(user),
        portfolioRecommendations: this.getFallbackPortfolioTips(user),
        generalTips: this.getFallbackGeneralTips(user),
      };
    }
  }

  /**
   * Generates a clean CV layout in text format (ready for PDF export).
   *
   * @param {String} userId - The ID of the user.
   * @param {Object} options - Options for CV generation (includeSummary, includeExperiences, etc.).
   * @returns {Object} CV text and metadata.
   */
  async generateCVLayout(userId, options = {}) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const {
      includeSummary = true,
      includeExperiences = true,
      includeSkills = true,
      includeEducation = true,
      includeInterests = false,
    } = options;

    // Generate professional summary if needed
    let professionalSummary = '';
    if (includeSummary) {
      try {
        const summaryData = await this.generateProfessionalSummary(userId);
        professionalSummary = summaryData.summary;
      } catch (error) {
        professionalSummary = this.generateFallbackSummary(user);
      }
    }

    // Generate bullet points for experiences
    const enhancedExperiences = [];
    if (includeExperiences && user.experiences && user.experiences.length > 0) {
      for (const exp of user.experiences.slice(0, 5)) {
        try {
          const bullets = await this.suggestBulletPoints(userId, exp);
          enhancedExperiences.push({
            ...exp,
            suggestedBullets: bullets.bulletPoints.slice(0, 3), // Top 3 bullets
          });
        } catch (error) {
          enhancedExperiences.push({
            ...exp,
            suggestedBullets: this.generateFallbackBullets(exp),
          });
        }
      }
    }

    // Build professional CV text with executive-level formatting
    const cvLines = [];

    // ============================================
    // HEADER SECTION - Executive Formatting
    // ============================================
    const name = (user.fullName || 'Your Name').toUpperCase();
    const namePadding = Math.max(0, Math.floor((70 - name.length) / 2));
    cvLines.push('');
    cvLines.push(' '.repeat(namePadding) + name);
    cvLines.push('═'.repeat(70));
    cvLines.push('');

    // Contact Information - Centered and Professional
    const contactInfo = [];
    if (user.email) contactInfo.push(`Email: ${user.email}`);
    if (user.phone) contactInfo.push(`Phone: ${user.phone}`);
    if (user.preferredTrack) contactInfo.push(`Specialization: ${user.preferredTrack}`);
    
    if (contactInfo.length > 0) {
      // Center contact info
      const contactLine = contactInfo.join('  |  ');
      const contactPadding = Math.max(0, Math.floor((70 - contactLine.length) / 2));
      cvLines.push(' '.repeat(contactPadding) + contactLine);
      cvLines.push('');
    }
    
    cvLines.push('═'.repeat(70));
    cvLines.push('');

    // ============================================
    // PROFESSIONAL SUMMARY - Executive Formatting
    // ============================================
    if (professionalSummary) {
      cvLines.push('PROFESSIONAL SUMMARY');
      cvLines.push('─'.repeat(70));
      cvLines.push('');
      
      // Format summary with proper paragraph breaks and indentation
      const summaryParagraphs = professionalSummary.split(/\.\s+/).filter(p => p.trim());
      summaryParagraphs.forEach((para, idx) => {
        const formattedPara = para.trim() + (idx < summaryParagraphs.length - 1 ? '.' : '');
        
        // Word wrap with proper indentation (68 characters for content)
        const words = formattedPara.split(' ');
        let currentLine = '  '; // 2-space indent for summary
        words.forEach(word => {
          if ((currentLine + word).length <= 68) {
            currentLine += (currentLine.trim() ? ' ' : '') + word;
          } else {
            if (currentLine.trim()) cvLines.push(currentLine);
            currentLine = '  ' + word;
          }
        });
        if (currentLine.trim()) cvLines.push(currentLine);
        
        // Add spacing between paragraphs
        if (idx < summaryParagraphs.length - 1) {
          cvLines.push('');
        }
      });
      cvLines.push('');
      cvLines.push('');
    }

    // ============================================
    // TECHNICAL SKILLS - Professional Categorization
    // ============================================
    if (includeSkills && user.skills && user.skills.length > 0) {
      cvLines.push('TECHNICAL SKILLS');
      cvLines.push('─'.repeat(70));
      cvLines.push('');
      
      // Categorize skills for better presentation
      const skillCategories = this.categorizeSkills(user.skills);
      const hasCategories = Object.values(skillCategories).some(cat => cat.length > 0);
      
      if (hasCategories && user.skills.length > 8) {
        // Show categorized skills with professional formatting
        Object.keys(skillCategories).forEach((category, catIdx) => {
          if (skillCategories[category].length > 0) {
            cvLines.push(`  ${category.toUpperCase()}:`);
            const skillsPerLine = 4;
            for (let i = 0; i < skillCategories[category].length; i += skillsPerLine) {
              const skillGroup = skillCategories[category].slice(i, i + skillsPerLine);
              cvLines.push(`    ${skillGroup.join('  •  ')}`);
            }
            if (catIdx < Object.keys(skillCategories).length - 1) {
              cvLines.push('');
            }
          }
        });
      } else {
        // Show flat list with professional formatting
        const skillsPerLine = 4;
        for (let i = 0; i < user.skills.length; i += skillsPerLine) {
          const skillGroup = user.skills.slice(i, i + skillsPerLine);
          cvLines.push(`  ${skillGroup.join('  •  ')}`);
        }
      }
      cvLines.push('');
      cvLines.push('');
    }

    // ============================================
    // PROFESSIONAL EXPERIENCE - Executive Formatting
    // ============================================
    if (enhancedExperiences.length > 0) {
      cvLines.push('PROFESSIONAL EXPERIENCE');
      cvLines.push('─'.repeat(70));
      cvLines.push('');
      
      enhancedExperiences.forEach((exp, idx) => {
        // Project/Experience Title - Bold and Prominent
        const title = exp.title || exp.role || `Project ${idx + 1}`;
        const role = exp.role && exp.role !== title ? ` - ${exp.role}` : '';
        cvLines.push(`  ${title.toUpperCase()}${role}`);
        cvLines.push('');
        
        // Duration and Technologies - Professional Metadata
        const metaInfo = [];
        if (exp.duration) metaInfo.push(`Duration: ${exp.duration}`);
        if (exp.technologies && exp.technologies.length > 0) {
          // Limit technologies display to top 6 for readability
          const techDisplay = exp.technologies.length > 6 
            ? `${exp.technologies.slice(0, 6).join(', ')}, +${exp.technologies.length - 6} more`
            : exp.technologies.join(', ');
          metaInfo.push(`Technologies: ${techDisplay}`);
        }
        if (metaInfo.length > 0) {
          cvLines.push(`    ${metaInfo.join('  |  ')}`);
          cvLines.push('');
        }
        
        // Professional Bullet Points - Executive Formatting
        if (exp.suggestedBullets && exp.suggestedBullets.length > 0) {
          exp.suggestedBullets.forEach((bullet) => {
            // Word wrap long bullet points with proper indentation
            if (bullet.length > 60) {
              const words = bullet.split(' ');
              let currentLine = '    • ';
              words.forEach((word) => {
                if ((currentLine + word).length <= 66) {
                  currentLine += (currentLine.trim().endsWith('•') ? '' : ' ') + word;
                } else {
                  if (currentLine.trim()) cvLines.push(currentLine);
                  currentLine = '      ' + word; // Indent continuation lines
                }
              });
              if (currentLine.trim()) cvLines.push(currentLine);
            } else {
              cvLines.push(`    • ${bullet}`);
            }
          });
        } else if (exp.description) {
          // Fallback to description with professional formatting
          const desc = exp.description;
          if (desc.length > 60) {
            const words = desc.split(' ');
            let currentLine = '    • ';
            words.forEach((word) => {
              if ((currentLine + word).length <= 66) {
                currentLine += (currentLine.trim().endsWith('•') ? '' : ' ') + word;
              } else {
                if (currentLine.trim()) cvLines.push(currentLine);
                currentLine = '      ' + word;
              }
            });
            if (currentLine.trim()) cvLines.push(currentLine);
          } else {
            cvLines.push(`    • ${desc}`);
          }
        }
        
        // Add spacing between experiences
        if (idx < enhancedExperiences.length - 1) {
          cvLines.push('');
          cvLines.push('');
        }
      });
      cvLines.push('');
    }

    // ============================================
    // EDUCATION - Professional Formatting
    // ============================================
    if (includeEducation && user.educationLevel) {
      cvLines.push('EDUCATION');
      cvLines.push('─'.repeat(70));
      cvLines.push('');
      cvLines.push(`  ${user.educationLevel}`);
      if (user.preferredTrack) {
        cvLines.push(`  Specialization: ${user.preferredTrack}`);
      }
      cvLines.push('');
      cvLines.push('');
    }

    // ============================================
    // CAREER INTERESTS - Professional Formatting (optional)
    // ============================================
    if (includeInterests && user.careerInterests && user.careerInterests.length > 0) {
      cvLines.push('CAREER INTERESTS');
      cvLines.push('─'.repeat(70));
      cvLines.push('');
      cvLines.push(`  ${user.careerInterests.join('  •  ')}`);
      cvLines.push('');
    }
    
    // ============================================
    // FOOTER - Professional Closing
    // ============================================
    cvLines.push('');
    cvLines.push('═'.repeat(70));
    cvLines.push(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    cvLines.push('═'.repeat(70));

    const cvText = cvLines.join('\n');

    return {
      cvText,
      metadata: {
        generatedAt: new Date(),
        userId: userId,
        sections: {
          summary: includeSummary,
          skills: includeSkills,
          experiences: includeExperiences,
          education: includeEducation,
          interests: includeInterests,
        },
      },
    };
  }

  /**
   * Categorize skills into groups for better presentation
   */
  categorizeSkills(skills) {
    const categories = {
      'Programming Languages': [],
      'Frameworks': [],
      'Tools': [],
      'Databases': [],
      'Cloud/DevOps': [],
      'Other': []
    };

    const langKeywords = ['javascript', 'python', 'java', 'typescript', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'dart'];
    const frameworkKeywords = ['react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'spring', 'laravel', 'next', 'nuxt', 'svelte'];
    const toolKeywords = ['git', 'docker', 'kubernetes', 'jenkins', 'ci/cd', 'webpack', 'vite', 'npm', 'yarn'];
    const dbKeywords = ['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'oracle', 'dynamodb', 'firebase'];
    const cloudKeywords = ['aws', 'azure', 'gcp', 'cloud', 'devops', 'terraform', 'ansible'];

    skills.forEach(skill => {
      const lowerSkill = skill.toLowerCase();
      if (langKeywords.some(kw => lowerSkill.includes(kw))) {
        categories['Programming Languages'].push(skill);
      } else if (frameworkKeywords.some(kw => lowerSkill.includes(kw))) {
        categories['Frameworks'].push(skill);
      } else if (dbKeywords.some(kw => lowerSkill.includes(kw))) {
        categories['Databases'].push(skill);
      } else if (cloudKeywords.some(kw => lowerSkill.includes(kw))) {
        categories['Cloud/DevOps'].push(skill);
      } else if (toolKeywords.some(kw => lowerSkill.includes(kw))) {
        categories['Tools'].push(skill);
      } else {
        categories['Other'].push(skill);
      }
    });

    return categories;
  }

  /**
   * Calculate total experience from projects/experiences
   */
  calculateTotalExperience(experiences) {
    let totalMonths = 0;
    experiences.forEach(exp => {
      try {
        const parsed = typeof exp === 'string' ? JSON.parse(exp) : exp;
        if (parsed.duration) {
          // Try to extract months from duration string
          const duration = parsed.duration.toLowerCase();
          const monthMatch = duration.match(/(\d+)\s*(?:month|mo)/);
          const yearMatch = duration.match(/(\d+)\s*(?:year|yr)/);
          if (monthMatch) totalMonths += parseInt(monthMatch[1]);
          if (yearMatch) totalMonths += parseInt(yearMatch[1]) * 12;
        }
      } catch (e) {
        // Skip if parsing fails
      }
    });
    return totalMonths;
  }

  // Fallback methods
  generateFallbackSummary(user) {
    const track = user.preferredTrack || 'your field';
    const level = user.experienceLevel || 'entry-level';
    const skills = user.skills?.slice(0, 4).join(', ') || 'various technical skills';
    const isFresher = level === 'Fresher' || level === 'entry-level';
    const projectCount = user.experiences?.length || 0;
    const topSkill = user.skills?.[0] || 'technical development';

    if (isFresher) {
      return `${track.charAt(0).toUpperCase() + track.slice(1)} professional with a strong foundation in ${skills} and a passion for building innovative solutions. Demonstrated ability to deliver ${projectCount > 0 ? `${projectCount} project${projectCount !== 1 ? 's' : ''} showcasing` : 'projects showcasing'} technical proficiency in ${topSkill} and related technologies. Eager to contribute to dynamic teams while continuously expanding expertise in ${track} and staying current with industry best practices. Seeking opportunities to apply technical skills and drive meaningful impact in a collaborative, growth-oriented environment.`;
    } else {
      return `Experienced ${track} professional with proven expertise in ${skills} and a track record of delivering high-quality solutions. ${projectCount > 0 ? `Successfully completed ${projectCount} project${projectCount !== 1 ? 's' : ''} demonstrating` : 'Demonstrated'} technical proficiency and problem-solving capabilities across various ${track} domains. Strong foundation in ${topSkill} with a commitment to continuous learning and staying abreast of emerging technologies. Seeking opportunities to leverage technical expertise and contribute to innovative projects while driving business value and technical excellence.`;
    }
  }

  generateFallbackBullets(experience) {
    const title = experience.title || experience.role || 'Project';
    const tech = experience.technologies?.join(', ') || 'modern technologies';
    const techList = experience.technologies || [];
    const primaryTech = techList[0] || 'relevant technologies';
    const secondaryTech = techList[1] || 'tools';

    return [
      `Architected and developed ${title} using ${tech}, implementing scalable solutions and following industry best practices`,
      `Engineered core features and functionality leveraging ${primaryTech} and ${secondaryTech}, resulting in improved performance and user experience`,
      `Collaborated with cross-functional teams to deliver high-quality solutions, ensuring code quality through testing and code reviews`,
      `Optimized application performance and implemented responsive design principles, enhancing usability across multiple platforms and devices`,
    ];
  }

  getFallbackLinkedInTips(user) {
    const track = user?.preferredTrack || 'your field';
    const topSkills = user?.skills?.slice(0, 3).join(', ') || 'your key skills';
    const experienceLevel = user?.experienceLevel || 'Fresher';
    const isFresher = experienceLevel === 'Fresher';
    const skill1 = user?.skills?.[0] || 'your primary skill';
    const skill2 = user?.skills?.[1] || 'your secondary skill';
    
    return [
      `Optimize your LinkedIn headline using the formula: "[Target Role] | [Core Competencies] | [Value Differentiator]". For ${track} professionals, craft headlines like "${isFresher ? 'Aspiring' : ''} ${track} | ${topSkills}${isFresher ? ' | Seeking Opportunities to Build Impactful Solutions' : ' | Delivering Scalable Solutions'}" - Research shows optimized headlines (120 characters max) increase profile views by 3x and improve ATS keyword matching by 40%`,
      `Structure your About/Summary section using the proven framework: (1) Compelling hook (first 2 lines) that captures attention, (2) Value proposition paragraph highlighting ${topSkills} and ${isFresher ? 'learning agility' : 'proven track record'}, (3) Career narrative connecting your passion for ${track} to your goals, (4) Clear call-to-action. Target 2,000 characters with 2-3% keyword density for terms like '${track}', '${skill1}', '${skill2}' to optimize for both human readers and ATS systems`,
      `Implement a strategic skills hierarchy: Prioritize ${topSkills} in your top 5 skills, then add 10-15 complementary technical and soft skills. LinkedIn's algorithm favors profiles with 15-20 skills, resulting in 13x more profile views. Systematically build endorsements by endorsing connections first (reciprocity principle), and request endorsements from colleagues who've seen your work with ${topSkills}`,
      `Transform your experience/project descriptions using the CAR framework (Challenge-Action-Result). For each entry, articulate the business challenge, your technical approach using ${topSkills}, and quantifiable impact. Example structure: "Developed [what] using [${skill1}, ${skill2}] to solve [problem], resulting in [metric]." Use power verbs (Architected, Optimized, Engineered) and include ATS keywords naturally - profiles with quantified achievements receive 5x more recruiter messages`,
      `Execute a comprehensive keyword optimization strategy: Integrate primary keywords ('${track}', '${skill1}', '${skill2}') in your headline (highest weight), summary (medium weight), and experience descriptions (lower weight). LinkedIn's search algorithm ranks profiles based on keyword relevance, recency, and completeness - profiles optimized for recruiter search terms appear in 5x more search results. Use long-tail variations like '${track} developer', '${skill1} specialist' for niche positioning`,
      `Achieve LinkedIn "All-Star" profile status by completing all sections: professional headshot (industry standard: business casual, clear background, 60% face visibility), customized background banner showcasing ${track} expertise, comprehensive education section, and certifications. LinkedIn's internal data shows All-Star profiles receive 40% more profile views and rank higher in search results. Additionally, enable "Open to Work" feature if ${isFresher ? 'actively seeking opportunities' : 'exploring new roles'}`,
      `Develop a strategic networking and engagement plan: Connect with ${track} professionals, recruiters, and industry leaders using personalized connection requests that reference shared interests or mutual connections. Establish thought leadership by sharing insights about ${topSkills} and ${track} trends 2-3 times per week. Join relevant groups like "${track} Professionals" and engage authentically - active profiles with regular engagement receive 5x more profile views and 3x more connection requests`,
    ];
  }

  getFallbackPortfolioTips(user) {
    const track = user?.preferredTrack || 'your field';
    const projectCount = user?.experiences?.length || 0;
    const topSkills = user?.skills?.slice(0, 5).join(', ') || 'your skills';
    const skill1 = user?.skills?.[0] || 'your primary technology';
    
    return [
      `Curate and showcase your ${projectCount || 'best'} project${projectCount !== 1 ? 's' : ''} using a strategic case study framework. For each project, structure: (1) Problem statement and business context, (2) Technical approach and architecture decisions highlighting ${topSkills}, (3) Challenges overcome with specific solutions, (4) Quantifiable results and impact metrics, (5) Technology stack with rationale for each choice, (6) Code quality indicators (GitHub links, live demos, test coverage). Include visual elements: high-quality screenshots, GIFs demonstrating functionality, and architecture diagrams. This case study format positions you as a strategic thinker, not just a coder`,
      `Develop a compelling "About" narrative that complements your LinkedIn profile while adding depth. Structure: (1) Professional introduction positioning you in ${track}, (2) Your journey and learning philosophy, (3) Technical expertise showcase (${topSkills}) with proficiency indicators, (4) What differentiates you in the ${track} space, (5) Career vision and goals. Use storytelling techniques to create emotional connection while maintaining professionalism. Include a professional headshot and consider adding a short video introduction (30-60 seconds) - portfolios with video see 80% higher engagement`,
      `Implement mobile-first responsive design with performance optimization as a core requirement. With 60%+ of recruiters viewing portfolios on mobile, ensure your site loads in under 3 seconds (Google's Core Web Vitals standard). Use modern CSS frameworks, optimize images (WebP format, lazy loading), minimize JavaScript bundles, and implement code splitting. Test across devices (iPhone, Android, tablets) and browsers. Research shows portfolios with load times >3 seconds lose 40% of visitors, while fast-loading sites have 2x higher conversion rates`,
      `Design strategic call-to-action (CTA) placement following conversion optimization principles. Place primary CTAs ("View Project", "Contact Me") above the fold, after each project showcase, and in a sticky header/footer. Use contrasting colors, clear typography, and action-oriented language. Include social proof: GitHub stars, project metrics, client testimonials. Make contact effortless with a prominent contact form, email link, and social media icons. A/B test CTA placement and copy - data shows strategic CTA placement increases recruiter outreach by 3x`,
      `Establish thought leadership through a blog/articles section focusing on ${track} insights, technical deep-dives, and learning experiences. Write 2-3 high-quality articles covering: technical challenges solved using ${topSkills}, architecture decisions and trade-offs, industry trends in ${track}, or tutorials demonstrating expertise. This demonstrates communication skills, problem-solving methodology, and passion for ${track}. Include code examples, diagrams, and real-world applications. Portfolios with technical blog content receive 50% more recruiter engagement and position you as a subject matter expert`,
      `Execute comprehensive SEO strategy for discoverability: (1) Technical SEO: Optimize meta tags, implement structured data (JSON-LD), create XML sitemap, ensure semantic HTML5 structure, (2) Content SEO: Target keywords like '${track} developer', '${skill1} portfolio', '${track} projects' in page titles, headings, and content with 1-2% keyword density, (3) On-page optimization: Include alt text for all images, optimize URL structure, implement internal linking, (4) Off-page: Get featured on portfolio showcase sites (Awwwards, Behance for design portfolios), contribute to ${track} communities, build backlinks through technical articles. Set up Google Search Console to track performance and optimize based on search analytics`,
      `Implement analytics and continuous improvement framework: Install Google Analytics 4 to track visitor behavior, conversion funnels, and traffic sources. Set up heatmaps (Hotjar, Crazy Egg) to understand user interaction patterns. Track key metrics: bounce rate (target: <40%), average session duration (target: >2 minutes), project view rate, contact form submissions. Conduct A/B testing on project presentation, CTA placement, and content structure. Regularly update with new projects and refresh content quarterly - active portfolios with fresh content rank higher in search and demonstrate continuous growth`,
    ];
  }

  getFallbackGeneralTips(user) {
    const track = user?.preferredTrack || 'your field';
    const topSkills = user?.skills?.slice(0, 3).join(', ') || 'your skills';
    const skill1 = user?.skills?.[0] || 'your primary skill';
    
    return [
      `Establish cross-platform brand consistency as a foundational element of your personal brand strategy. Maintain visual identity (professional photo, color scheme, typography) and messaging consistency across LinkedIn, portfolio, GitHub, and other professional platforms. Research shows consistent branding increases brand recognition by 80% and makes you 3x more memorable to recruiters. Create a brand style guide documenting your professional photo, color palette, tone of voice, and key messaging points to ensure consistency as you expand your online presence`,
      `Execute a strategic keyword ecosystem optimization across all platforms. Develop a keyword map targeting primary terms ('${track}', '${skill1}'), secondary terms ('${topSkills}'), and long-tail keywords ('${track} developer portfolio', '${skill1} specialist'). Integrate these consistently across LinkedIn (headline, summary, experience), portfolio (meta tags, content, headings), and GitHub (README files, project descriptions). Platform-specific optimization: LinkedIn prioritizes headline keywords, portfolios benefit from content keyword density, GitHub READMEs should include technology stack keywords. Consistent keyword usage across platforms increases search visibility by 5x and improves ATS matching`,
      `Develop a content marketing strategy to establish thought leadership in ${track}. Create a content calendar targeting 2-3 posts per week on LinkedIn covering: technical insights about ${topSkills}, industry trends, project learnings, or career advice. Publish longer-form articles (800-1200 words) on your portfolio blog covering technical deep-dives, architecture decisions, or tutorials. Cross-promote content across platforms: LinkedIn posts linking to portfolio articles, GitHub READMEs referencing blog posts. Track engagement metrics (likes, comments, shares, views) and optimize based on performance. Active content creators receive 5x more profile views and establish credibility as subject matter experts`,
      `Build strategic network and community engagement: Join ${track}-related communities (Discord servers, Slack groups, Reddit forums, Stack Overflow) and actively contribute valuable insights. Participate in open source projects using ${topSkills} to build reputation and demonstrate code quality. Attend virtual and in-person conferences, webinars, and meetups in ${track} to network with industry professionals. Seek mentorship from senior ${track} professionals while also offering mentorship to newcomers - this dual approach builds relationships and establishes you as both a learner and a contributor. Research shows professionals with active community engagement receive 3x more job opportunities through referrals`,
      `Implement a continuous improvement and monitoring system for your online presence. Set up Google Alerts for your name and ${track} keywords to monitor your digital footprint. Regularly audit all platforms quarterly: update projects, refresh content, optimize based on analytics data, and ensure all links are working. Track key performance indicators: LinkedIn profile views, portfolio traffic sources, GitHub repository stars, and engagement rates. Use this data to iterate and improve - portfolios that are updated monthly show 40% higher engagement than static ones. Additionally, monitor your personal brand reputation and address any inconsistencies or outdated information promptly`,
    ];
  }
}

module.exports = new CVProfileAssistantAgent();

