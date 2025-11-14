const aiService = require('./aiService');

class CVExtractionService {
  async extractSkillsFromCV(cvText, preferredTrack = '') {
    if (!cvText || cvText.trim().length < 50) {
      throw new Error('CV text is too short or empty');
    }

    const prompt = `Analyze this CV/resume text and extract structured information.

CV Text:
${cvText}

${preferredTrack ? `Preferred Career Track: ${preferredTrack}` : ''}

EXTRACTION STRATEGY:

FOR SKILLS:
1. FIRST, search the CV text for sections that contain words like "Skills", "Expertise", "Strengths", "Competencies", "Core Skills", "Key Skills", "Technical Skills", "Professional Skills", "STRENGTHS AND EXPERTISE", "STRENGTHS", "EXPERTISE", "Core Competencies", "Key Competencies", etc.
2. Extract ONLY items listed under those sections (e.g., "P&L Management", "Business Development", "Strategic Planning", "Financial Reporting", "Negotiation Skills", "Client Relationship Management", "Team Leadership", "Communication", "Operations Management", "JavaScript", "React", "Web Design", "Design Thinking", etc.)
3. DO NOT extract:
   - School names (e.g., "Really Great High School", "Really Great University")
   - Years (e.g., "2010", "2014", "2016")
   - Date ranges (e.g., "2010 - 2014")
   - Degree names (e.g., "BACHELOR OF TECHNOLOGY", "SECONDARY SCHOOL")
   - Education section content
   - Experience section dates or company names
4. Include BOTH technical skills (programming languages, frameworks, libraries) AND business/management/soft skills (leadership, communication, negotiation, P&L Management, etc.)
5. If you find a "Skills" or "Expertise" section, extract everything listed there - but validate that each item is actually a skill, not education/experience information
6. Also look for skills mentioned in the summary/experience sections (but not dates, years, or institution names)
7. Extract skills from bullet points, lists, or comma-separated values in these sections
8. Validate each extracted item: it should be a skill/competency, not a school name, year, degree, or other non-skill information

FOR TOOLS:
1. FIRST, search the CV text for sections that contain the word "Tools" (e.g., "Tools:", "Software Tools:", "Development Tools:", "Design Tools:", "Tools Used:", etc.)
2. Extract ONLY the items that are explicitly listed under those "Tools" sections
3. If you find a "Tools" section, extract everything listed there (e.g., "Git, Figma, VS Code, Postman")
4. If NO "Tools" section exists in the CV, then infer tools from context (software applications mentioned)
5. DO NOT include databases, frameworks, or libraries in tools - only actual software tools

FOR ROLES/DOMAIN/DESIGNATION:
1. Look for job titles, designations, or roles mentioned in the CV (e.g., "Frontend Developer", "Software Engineer", "Data Analyst", "UI/UX Designer", "Full Stack Developer", "Product Designer")
2. Check sections like "Experience", "Work Experience", "Professional Experience", "Current Role", "Position", "Designation", "Job Title"
3. Extract the most recent or current role/designation FIRST (this is the primary role)
4. Also identify other relevant career domains/roles the person has worked in
5. Look for patterns like "Worked as...", "Position:", "Role:", "Designation:", "Title:"
6. Return the primary role/designation as the FIRST item in the "roles" array, followed by other related roles
7. If the CV mentions "Seeking position as..." or "Looking for...", that can also indicate the desired role

Extract and return JSON with this exact structure:
{
  "skills": ["skill1", "skill2", "skill3"],
  "tools": ["tool1", "tool2"],
  "technologies": ["tech1", "tech2"],
  "roles": ["primary_role", "role2", "role3"],
  "primaryRole": "primary_role",
  "experienceLevel": "Fresher" or "Junior" or "Mid",
  "summary": "Brief professional summary in 2-3 sentences",
  "confidence": 0.85
}

Note: "primaryRole" should be the current/most recent designation found in the CV. "roles" array should have primary role first, then other related roles.

IMPORTANT DISTINCTIONS:
- "skills": ALL types of skills including:
  * Technical skills: Programming languages, frameworks, libraries, methodologies (e.g., "JavaScript", "React", "Express", "Angular", "Agile", "REST API")
  * Business skills: P&L Management, Business Development, Strategic Planning, Financial Reporting, Market Analysis, etc.
  * Management skills: Team Leadership, Operations Management, Project Management, People Management, etc.
  * Soft skills: Communication, Negotiation, Client Relationship Management, Problem Solving, etc.
  * Domain expertise: Media Management, Financial Analysis, Supply Chain Management, etc.
  * Look for sections like "Skills", "Expertise", "Strengths", "STRENGTHS AND EXPERTISE", "Core Competencies" and extract ALL items from those sections
- "tools": ONLY software applications, services, platforms used for development/workflow that are explicitly mentioned in a "Tools" section or clearly identified as tools (e.g., "Git", "Figma", "Firebase", "VS Code", "Postman", "Jira", "Slack", "Trello", "Docker", "Chrome DevTools")
- "technologies": Tech stacks, architectures, systems (e.g., "MERN Stack", "Microservices", "Cloud Computing", "CI/CD", "REST API", "GraphQL")
- "roles": Job titles, designations, and career domains found in the CV. Look for actual roles mentioned in experience sections (e.g., "Frontend Developer", "Backend Developer", "Software Engineer", "Data Analyst", "UI/UX Designer", "Full Stack Developer", "Product Designer", "Business Operations Manager"). Extract the user's current/most recent designation and related roles.
- DO NOT include databases (MongoDB, MySQL, PostgreSQL, etc.) in ANY category - exclude them completely
- DO NOT duplicate items between skills, tools, and technologies
- Each item should appear in only ONE category
- Frameworks (React, Angular, Express, etc.) go in "skills", NOT "tools"
- Libraries (jQuery, Lodash, etc.) go in "skills", NOT "tools"
- If you find a "Tools" section in the CV, extract ONLY what's listed there
- If you find a "Skills" or "Expertise" section, extract ALL items listed there (technical, business, management, soft skills)

Guidelines:
- Skills: Extract ALL types of skills from "Skills", "Expertise", "Strengths", "STRENGTHS AND EXPERTISE" sections:
  * Technical: Programming languages (JavaScript, Python), frameworks (React, Angular, Express), libraries (jQuery, Lodash)
  * Business: P&L Management, Business Development, Strategic Planning, Financial Reporting, Market Analysis
  * Management: Team Leadership, Operations Management, Project Management, People Management
  * Soft Skills: Communication, Negotiation, Client Relationship Management, Problem Solving, Collaboration
  * Extract everything listed in skills/expertise sections - don't filter by type
- Tools: ONLY extract from "Tools" sections in CV. Software applications/services for workflow (Git, Figma, VS Code, Postman, Jira, Slack, Docker, Chrome DevTools). NO databases, NO frameworks, NO libraries.
- Technologies: Tech stacks (MERN, MEAN), architectures (Microservices), systems (CI/CD, Cloud Computing, REST API, GraphQL). NO databases.
- Roles: Extract actual job titles, designations, and roles from CV experience sections. Look for titles like "Frontend Developer", "Backend Developer", "Software Engineer", "Data Analyst", "UI/UX Designer", "Full Stack Developer", "Product Designer", "Business Operations Manager", etc. Include the user's current/most recent designation.
- Databases: DO NOT include in any category - completely exclude MongoDB, MySQL, PostgreSQL, etc.
- Infer experience level from content (Fresher, Junior, or Mid)
- Normalize skill names (e.g., "React.js" -> "React")
- Confidence should be between 0 and 1
- Summary should be professional and concise

Return ONLY valid JSON, no markdown, no explanations.`;

    try {
      const extracted = await aiService.generateStructuredJSON(prompt);
      
      // Clean and deduplicate data
      let skills = Array.isArray(extracted.skills) ? extracted.skills : [];
      let tools = Array.isArray(extracted.tools) ? extracted.tools : [];
      let technologies = Array.isArray(extracted.technologies) ? extracted.technologies : [];
      const roles = Array.isArray(extracted.roles) ? extracted.roles : [];
      
      // Validate and filter out non-skill items
      skills = this.validateSkills(skills);
      
      // Known databases - EXCLUDE completely, don't show in any category
      const databases = ['mongodb', 'mysql', 'postgresql', 'redis', 'elasticsearch', 'sqlite', 'oracle', 'sql server', 'firebase database', 'dynamodb', 'cassandra', 'neo4j', 'couchdb'];
      
      // Known frameworks - should be in skills, not tools
      const frameworks = ['react', 'angular', 'vue', 'express', 'django', 'flask', 'spring', 'laravel', 'next.js', 'nuxt.js', 'svelte', 'ember', 'nest.js'];
      
      // Known libraries - should be in skills, not tools
      const libraries = ['jquery', 'lodash', 'redux', 'axios', 'moment', 'underscore', 'rxjs'];
      
      // Remove databases completely from all categories
      skills = skills.filter(skill => 
        !databases.some(db => skill.toLowerCase().includes(db))
      );
      tools = tools.filter(tool => 
        !databases.some(db => tool.toLowerCase().includes(db))
      );
      technologies = technologies.filter(tech => 
        !databases.some(db => tech.toLowerCase().includes(db))
      );
      
      // Move frameworks from tools to skills
      const frameworksInTools = tools.filter(tool => 
        frameworks.some(fw => tool.toLowerCase().includes(fw))
      );
      tools = tools.filter(tool => 
        !frameworks.some(fw => tool.toLowerCase().includes(fw))
      );
      skills = [...skills, ...frameworksInTools];
      
      // Move libraries from tools to skills
      const librariesInTools = tools.filter(tool => 
        libraries.some(lib => tool.toLowerCase().includes(lib))
      );
      tools = tools.filter(tool => 
        !libraries.some(lib => tool.toLowerCase().includes(lib))
      );
      skills = [...skills, ...librariesInTools];
      
      // Remove duplicates between skills and tools/technologies
      tools = tools.filter(tool => 
        !skills.some(skill => skill.toLowerCase() === tool.toLowerCase())
      );
      technologies = technologies.filter(tech => 
        !skills.some(skill => skill.toLowerCase() === tech.toLowerCase()) &&
        !tools.some(tool => tool.toLowerCase() === tech.toLowerCase())
      );
      
      // Remove duplicates within each category
      skills = [...new Set(skills)];
      tools = [...new Set(tools)];
      technologies = [...new Set(technologies)];
      
      // Extract primary role (first role in array, or from primaryRole field)
      const primaryRole = extracted.primaryRole || (roles.length > 0 ? roles[0] : null);
      
      return {
        skills,
        tools,
        technologies,
        roles,
        primaryRole: primaryRole || (roles.length > 0 ? roles[0] : null),
        experienceLevel: extracted.experienceLevel || 'Fresher',
        summary: extracted.summary || '',
        confidence: extracted.confidence || 0.5,
      };
    } catch (error) {
      console.error('CV Extraction Error:', error);
      // Fallback to keyword-based extraction
      return this.fallbackExtraction(cvText);
    }
  }

  /**
   * Validate if extracted items are actually skills
   * Filters out school names, years, degree names, etc.
   */
  validateSkills(skills) {
    if (!Array.isArray(skills)) return [];
    
    return skills.filter(skill => {
      if (!skill || typeof skill !== 'string') return false;
      
      const trimmed = skill.trim();
      if (trimmed.length < 2 || trimmed.length > 50) return false;
      
      const lowerSkill = trimmed.toLowerCase();
      
      // Filter out years (e.g., "2010", "2014", "2016")
      if (/^\d{4}$/.test(trimmed)) return false;
      
      // Filter out date ranges (e.g., "2010 - 2014", "2014-2016")
      if (/^\d{4}\s*[-–—]\s*\d{4}$/.test(trimmed)) return false;
      
      // Filter out common education section keywords and patterns
      const educationKeywords = [
        'school', 'university', 'college', 'institute', 'academy',
        'bachelor', 'master', 'phd', 'doctorate', 'degree', 'diploma',
        'certificate', 'certification', 'secondary', 'primary', 'high school',
        'undergraduate', 'graduate', 'postgraduate', 'education', 'gpa',
        'cgpa', 'grade', 'marks', 'percentage', 'year', 'semester', 'course'
      ];
      
      // Filter out if it's an education keyword or contains education patterns
      if (educationKeywords.some(keyword => {
        const hasKeyword = lowerSkill.includes(keyword);
        if (!hasKeyword) return false;
        
        // Check for common education patterns
        const educationPatterns = [
          /bachelor\s+of/i,
          /master\s+of/i,
          /doctorate\s+of/i,
          /degree\s+in/i,
          /diploma\s+in/i,
          /certificate\s+in/i,
          /secondary\s+school/i,
          /high\s+school/i,
          /primary\s+school/i,
          /university/i,
          /college/i,
          /institute/i,
          /academy/i
        ];
        
        return educationPatterns.some(pattern => pattern.test(trimmed)) ||
               lowerSkill === keyword ||
               lowerSkill.includes(`${keyword} of`) ||
               lowerSkill.includes(`of ${keyword}`) ||
               lowerSkill.includes(`${keyword} in`);
      })) {
        return false;
      }
      
      // Filter out school/university names (contains "school", "university", "college" with proper nouns)
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:School|University|College|Institute|Academy)$/.test(trimmed)) {
        return false;
      }
      
      // Filter out if it looks like a school name (starts with capital, contains school/university/college)
      if (/^[A-Z][a-zA-Z\s]+(?:School|University|College|Institute|Academy)$/.test(trimmed)) {
        return false;
      }
      
      // Filter out common experience section keywords
      const experienceKeywords = [
        'present', 'company', 'corporation', 'inc', 'ltd', 'llc',
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
        'years', 'months', 'experience', 'worked', 'employed'
      ];
      
      if (experienceKeywords.some(keyword => lowerSkill === keyword || 
          lowerSkill.startsWith(`${keyword} `) || lowerSkill.endsWith(` ${keyword}`))) {
        return false;
      }
      
      // Filter out common section headers
      const sectionHeaders = [
        'skills', 'expertise', 'strengths', 'competencies', 'education',
        'experience', 'profile', 'contact', 'summary', 'objective',
        'projects', 'awards', 'certifications', 'languages', 'references'
      ];
      
      if (sectionHeaders.includes(lowerSkill)) return false;
      
      // Filter out email addresses
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
      
      // Filter out phone numbers
      if (/^[\d\s\-\(\)\+]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7) return false;
      
      // Filter out URLs
      if (/^https?:\/\//.test(trimmed)) return false;
      
      // Filter out addresses (contains common address words and numbers)
      if (/\d+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|circle|cir)/i.test(trimmed)) return false;
      
      // Keep skills that contain letters and are meaningful
      if (!/[a-zA-Z]/.test(trimmed)) return false;
      
      return true;
    }).map(skill => skill.trim());
  }

  fallbackExtraction(cvText) {
    // Simple keyword-based fallback with proper categorization
    const lowerText = cvText.toLowerCase();
    
    // Skills (programming languages, frameworks, libraries, business, management, soft skills)
    const skillKeywords = [
      // Technical skills
      'JavaScript', 'Python', 'React', 'Node.js', 'Java', 'HTML', 'CSS',
      'TypeScript', 'Angular', 'Vue', 'Express', 'Django', 'Flask', 
      'PHP', 'C++', 'C#', '.NET', 'SQL', 'Machine Learning', 'Data Analysis',
      'jQuery', 'Lodash', 'Redux', 'Next.js', 'Nuxt.js',
      // Business skills
      'P&L Management', 'Business Development', 'Strategic Planning', 'Financial Reporting',
      'Market Analysis', 'Sales', 'Marketing', 'Revenue Management',
      // Management skills
      'Team Leadership', 'Operations Management', 'Project Management', 'People Management',
      'Process Improvement', 'Change Management', 'Resource Management',
      // Soft skills
      'Communication', 'Negotiation', 'Client Relationship Management', 'Problem Solving',
      'Collaboration', 'Stakeholder Management', 'Presentation Skills'
    ];
    
    // Tools (software applications, services for workflow) - ONLY actual tools
    const toolKeywords = [
      'Git', 'Figma', 'VS Code', 'Postman', 'Jira', 
      'Photoshop', 'Illustrator', 'Slack', 'Trello', 'Docker', 'AWS Console',
      'Chrome DevTools', 'npm', 'yarn', 'Webpack', 'Vite', 'Notion', 'Confluence'
    ];
    
    // Technologies (stacks, architectures, systems) - NO databases
    const techKeywords = [
      'MERN Stack', 'MEAN Stack', 'Microservices', 'REST API', 
      'Cloud Computing', 'CI/CD', 'DevOps', 'GraphQL', 'Serverless'
    ];
    
    // Databases - EXCLUDE from all categories
    const databaseKeywords = [
      'MongoDB', 'MySQL', 'PostgreSQL', 'Redis', 'Elasticsearch',
      'SQLite', 'Oracle', 'SQL Server', 'Firebase', 'DynamoDB', 'Cassandra'
    ];
    
    let foundSkills = skillKeywords.filter(skill => 
      lowerText.includes(skill.toLowerCase()) &&
      !databaseKeywords.some(db => skill.toLowerCase().includes(db.toLowerCase()))
    );
    
    // Validate extracted skills
    foundSkills = this.validateSkills(foundSkills);
    
    const foundTools = toolKeywords.filter(tool => 
      lowerText.includes(tool.toLowerCase()) &&
      !foundSkills.some(skill => skill.toLowerCase() === tool.toLowerCase()) &&
      !databaseKeywords.some(db => tool.toLowerCase().includes(db.toLowerCase()))
    );
    
    const foundTechnologies = techKeywords.filter(tech => 
      lowerText.includes(tech.toLowerCase()) &&
      !foundSkills.some(skill => skill.toLowerCase() === tech.toLowerCase()) &&
      !foundTools.some(tool => tool.toLowerCase() === tech.toLowerCase()) &&
      !databaseKeywords.some(db => tech.toLowerCase().includes(db.toLowerCase()))
    );

    // Try to infer experience level
    let experienceLevel = 'Fresher';
    if (lowerText.includes('senior') || lowerText.includes('lead') || lowerText.includes('5+ years')) {
      experienceLevel = 'Mid';
    } else if (lowerText.includes('junior') || lowerText.includes('1-3 years') || lowerText.includes('2+ years')) {
      experienceLevel = 'Junior';
    }

    // Try to extract roles from CV text
    const rolePatterns = [
      /(?:worked as|position|role|designation|title)[\s:]+([a-z\s]+(?:developer|engineer|designer|analyst|manager|specialist|architect))/i,
      /(frontend|backend|full.?stack|software|data|ui\/?ux|product|web|mobile|devops)[\s]+(developer|engineer|designer|analyst|architect|specialist)/i,
    ];
    
    const foundRoles = [];
    rolePatterns.forEach(pattern => {
      const matches = cvText.match(new RegExp(pattern, 'gi'));
      if (matches) {
        matches.forEach(match => {
          const role = match.replace(/(?:worked as|position|role|designation|title)[\s:]+/i, '').trim();
          if (role && !foundRoles.includes(role)) {
            foundRoles.push(role);
          }
        });
      }
    });
    
    // If no roles found, try common role keywords
    if (foundRoles.length === 0) {
      const commonRoles = [
        'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
        'Software Engineer', 'Data Analyst', 'UI/UX Designer', 'Product Designer',
        'Web Developer', 'Mobile Developer', 'DevOps Engineer'
      ];
      
      commonRoles.forEach(role => {
        if (lowerText.includes(role.toLowerCase().replace(/\s+/g, ' '))) {
          foundRoles.push(role);
        }
      });
    }

    return {
      skills: foundSkills,
      tools: foundTools,
      technologies: foundTechnologies,
      roles: foundRoles,
      primaryRole: foundRoles.length > 0 ? foundRoles[0] : null,
      experienceLevel,
      summary: '',
      confidence: 0.3,
    };
  }
}

module.exports = new CVExtractionService();

