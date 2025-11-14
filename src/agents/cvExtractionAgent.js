const aiService = require('../services/aiService');

/**
 * CV Extraction Agent
 * 
 * Purpose: Extracts structured information (skills, tools, technologies, roles) from CV/resume text or PDF
 * 
 * Responsibilities:
 * - Extract skills (technical, business, management, soft skills) from CV text
 * - Extract tools (software applications, development tools) from CV
 * - Extract technologies (tech stacks, architectures, systems) from CV
 * - Extract roles/domain/designation (job titles, career domains) from CV
 * - Validate extracted data to filter out non-skill items (school names, years, degrees)
 * - Categorize and deduplicate extracted information
 * - Infer experience level from CV content
 * - Generate professional summary from CV
 * 
 * Usage:
 *   const agent = require('./agents/cvExtractionAgent');
 *   const extracted = await agent.extractSkillsFromCV(cvText, preferredTrack);
 */
class CVExtractionAgent {
  /**
   * Extract structured information from CV text
   * 
   * @param {String} cvText - CV/resume text content
   * @param {String} preferredTrack - User's preferred career track (optional)
   * @returns {Object} Extracted data with skills, tools, technologies, roles, etc.
   */
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
3. If you find a "Tools" section, extract everything listed there (e.g., "Git, Figma, Firebase, VS Code, Postman")
4. If NO "Tools" section exists in the CV, then infer tools from context (software applications, platforms, services mentioned)
5. Tools are SOFTWARE APPLICATIONS, PLATFORMS, or SERVICES you USE (e.g., Git, Figma, Firebase, VS Code, Postman, Jira, Slack, Docker, Vercel, Netlify, Photoshop, Notion)
6. DO NOT include in tools:
   - Databases (MongoDB, MySQL, etc.) - exclude completely
   - Frameworks (React, Angular, etc.) - these are skills
   - Libraries (jQuery, Lodash, etc.) - these are skills
   - Tech stacks (MERN, MEAN, LAMP) - these are technologies, NOT tools
   - Programming languages - these are skills
7. Remember: MERN Stack is a TECHNOLOGY (tech stack), NOT a tool. Firebase is a TOOL/PLATFORM, NOT a technology.

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
- "tools": ONLY software applications, services, platforms, and development tools used for workflow/productivity. Examples: "Git", "Figma", "Firebase", "VS Code", "Postman", "Jira", "Slack", "Trello", "Docker", "Chrome DevTools", "Vercel", "Netlify", "Photoshop", "Notion". These are actual software applications or platforms you USE, not things you BUILD WITH.
- "technologies": Tech stacks (e.g., "MERN Stack", "MEAN Stack", "LAMP Stack"), architectures (e.g., "Microservices", "Monolithic", "Serverless"), systems/patterns (e.g., "CI/CD", "REST API", "GraphQL", "Cloud Computing"). These are technology approaches, NOT individual tools. IMPORTANT: "MERN Stack" is a TECHNOLOGY, NOT a tool. "Firebase" is a TOOL/PLATFORM, NOT a technology.
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
- Tools: ONLY extract actual software applications, platforms, and services used for development/workflow/productivity. Examples: Git, Figma, Firebase, VS Code, Postman, Jira, Slack, Docker, Chrome DevTools, Vercel, Netlify, Photoshop, Notion. These are things you USE as tools. NO databases, NO frameworks, NO libraries, NO tech stacks (MERN, MEAN are NOT tools - they are technologies).
- Technologies: Tech stacks (MERN Stack, MEAN Stack, LAMP Stack - these are NOT tools), architectures (Microservices, Monolithic, Serverless), systems/patterns (CI/CD, REST API, GraphQL, Cloud Computing). These are technology approaches and methodologies. NO databases, NO individual tools.
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
      
      // Known tech stacks - should be in technologies, NOT tools
      const techStacks = ['mern', 'mean', 'mevn', 'lamp', 'lemp', 'jamstack', 'serverless', 'full stack', 'fullstack'];
      
      // Patterns that indicate technologies (not tools) - more comprehensive
      const technologyPatterns = [
        /stack/i,                    // Any "stack" (MERN Stack, MEAN Stack, etc.)
        /full\s*stack/i,            // Full Stack, Fullstack, Full-Stack
        /development/i,              // "Development" (Full Stack Development, etc.)
        /architecture/i,             // Architecture patterns
        /pattern/i,                  // Design patterns
        /methodology/i,              // Methodologies
      ];
      
      // Known tools/platforms/services - these ARE tools
      const knownTools = [
        'git', 'github', 'gitlab', 'bitbucket',
        'figma', 'adobe xd', 'sketch', 'invision', 'zeplin',
        'vs code', 'visual studio code', 'sublime', 'atom', 'webstorm', 'intellij',
        'postman', 'insomnia', 'swagger', 'api client',
        'jira', 'trello', 'asana', 'notion', 'confluence', 'slack', 'discord', 'teams',
        'docker', 'kubernetes', 'jenkins', 'circleci', 'travis', 'github actions',
        'chrome devtools', 'firefox devtools', 'safari devtools',
        'npm', 'yarn', 'pnpm', 'webpack', 'vite', 'parcel', 'rollup',
        'firebase', 'vercel', 'netlify', 'heroku', 'aws console', 'azure portal', 'gcp console',
        'photoshop', 'illustrator', 'premiere', 'after effects', 'figma', 'adobe creative suite',
        'excel', 'google sheets', 'notion', 'airtable'
      ];
      
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
      
      // Move tech stacks from tools to technologies (e.g., MERN, MEAN)
      const techStacksInTools = tools.filter(tool => 
        techStacks.some(stack => tool.toLowerCase().includes(stack) || stack.includes(tool.toLowerCase()))
      );
      tools = tools.filter(tool => 
        !techStacks.some(stack => tool.toLowerCase().includes(stack) || stack.includes(tool.toLowerCase()))
      );
      // Normalize tech stack names (e.g., "MERN" -> "MERN Stack", "MEAN" -> "MEAN Stack")
      const normalizedTechStacksFromTools = techStacksInTools.map(tool => {
        const lowerTool = tool.toLowerCase();
        const matchedStack = techStacks.find(stack => lowerTool.includes(stack) || stack.includes(lowerTool));
        if (matchedStack) {
          // If it's already "MERN Stack" or similar, keep it; otherwise normalize
          if (lowerTool.includes('stack')) {
            return tool; // Already has "Stack"
          }
          // Normalize: "MERN" -> "MERN Stack", "MEAN" -> "MEAN Stack"
          const normalized = matchedStack.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') + ' Stack';
          return normalized;
        }
        return tool;
      });
      technologies = [...technologies, ...normalizedTechStacksFromTools];
      
      // Move tech stacks from skills to technologies (if mistakenly placed)
      const techStacksInSkills = skills.filter(skill => 
        techStacks.some(stack => skill.toLowerCase().includes(stack) || stack.includes(skill.toLowerCase()))
      );
      skills = skills.filter(skill => 
        !techStacks.some(stack => skill.toLowerCase().includes(stack) || stack.includes(skill.toLowerCase()))
      );
      // Normalize tech stack names from skills too
      const normalizedTechStacksFromSkills = techStacksInSkills.map(skill => {
        const lowerSkill = skill.toLowerCase();
        const matchedStack = techStacks.find(stack => lowerSkill.includes(stack) || stack.includes(lowerSkill));
        if (matchedStack) {
          if (lowerSkill.includes('stack')) {
            return skill;
          }
          const normalized = matchedStack.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') + ' Stack';
          return normalized;
        }
        return skill;
      });
      technologies = [...technologies, ...normalizedTechStacksFromSkills];
      
      // Validate tools - ensure they are actually tools (software applications, platforms, services)
      // If a tool doesn't match known tools list, verify it's not a tech stack or framework
      const validatedTools = tools.filter(tool => {
        const lowerTool = tool.toLowerCase();
        // If it's in known tools list, keep it
        if (knownTools.some(kt => lowerTool.includes(kt) || kt.includes(lowerTool))) {
          return true;
        }
        // If it contains "stack" or is a tech stack, move to technologies
        if (lowerTool.includes('stack') || techStacks.some(stack => lowerTool.includes(stack) || stack.includes(lowerTool))) {
          // Normalize the tech stack name
          const matchedStack = techStacks.find(stack => lowerTool.includes(stack) || stack.includes(lowerTool));
          if (matchedStack && !lowerTool.includes('stack')) {
            const normalized = matchedStack.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ') + ' Stack';
            if (!technologies.some(tech => tech.toLowerCase() === normalized.toLowerCase())) {
              technologies.push(normalized);
            }
          } else if (!technologies.some(tech => tech.toLowerCase() === lowerTool)) {
            technologies.push(tool);
          }
          return false;
        }
        // If it's a framework or library, move to skills
        if (frameworks.some(fw => lowerTool.includes(fw)) || libraries.some(lib => lowerTool.includes(lib))) {
          skills.push(tool);
          return false;
        }
        // If it looks like a software tool (contains common tool patterns), keep it
        const toolPatterns = ['git', 'code', 'studio', 'tool', 'client', 'devtools', 'console', 'portal'];
        if (toolPatterns.some(pattern => lowerTool.includes(pattern))) {
          return true;
        }
        // Otherwise, it might be misclassified - keep it but with lower confidence
        return true;
      });
      tools = validatedTools;
      
      // Final cleanup: Remove any remaining tech stacks from tools
      tools = tools.filter(tool => {
        const lowerTool = tool.toLowerCase();
        const isTechStack = techStacks.some(stack => 
          lowerTool === stack || 
          lowerTool.includes(stack) || 
          stack.includes(lowerTool) ||
          lowerTool.includes('stack')
        );
        
        if (isTechStack) {
          // Normalize and add to technologies
          const matchedStack = techStacks.find(stack => 
            lowerTool.includes(stack) || stack.includes(lowerTool)
          );
          if (matchedStack && !lowerTool.includes('stack')) {
            const normalized = matchedStack.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ') + ' Stack';
            if (!technologies.some(tech => tech.toLowerCase() === normalized.toLowerCase())) {
              technologies.push(normalized);
            }
          } else if (!technologies.some(tech => tech.toLowerCase() === lowerTool)) {
            technologies.push(tool);
          }
          return false;
        }
        return true;
      });
      
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
      
      // Final pass: Ensure no tech stacks remain in tools
      const remainingTechStacks = tools.filter(tool => {
        const lowerTool = tool.toLowerCase();
        return techStacks.some(stack => 
          lowerTool === stack || 
          lowerTool.includes(stack) || 
          stack.includes(lowerTool) ||
          lowerTool.includes('stack')
        );
      });
      
      if (remainingTechStacks.length > 0) {
        // Move remaining tech stacks to technologies
        const normalizedRemaining = remainingTechStacks.map(tool => {
          const lowerTool = tool.toLowerCase();
          const matchedStack = techStacks.find(stack => 
            lowerTool.includes(stack) || stack.includes(lowerTool)
          );
          if (matchedStack && !lowerTool.includes('stack')) {
            return matchedStack.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ') + ' Stack';
          }
          return tool;
        });
        
        technologies = [...technologies, ...normalizedRemaining];
        tools = tools.filter(tool => !remainingTechStacks.includes(tool));
        technologies = [...new Set(technologies)]; // Remove duplicates again
      }
      
      // Pre-AI cleanup: Remove obvious technologies from tools using patterns
      const obviousTechnologies = tools.filter(tool => {
        const lowerTool = tool.toLowerCase();
        // Check if it matches tech stack names
        if (techStacks.some(stack => 
          lowerTool === stack || 
          lowerTool.includes(stack) || 
          stack.includes(lowerTool)
        )) {
          return true;
        }
        // Check if it matches technology patterns
        if (technologyPatterns.some(pattern => pattern.test(tool))) {
          return true;
        }
        return false;
      });
      
      if (obviousTechnologies.length > 0) {
        // Normalize and move to technologies
        const normalizedObvious = obviousTechnologies.map(item => {
          const lowerItem = item.toLowerCase();
          const matchedStack = techStacks.find(stack => 
            lowerItem.includes(stack) || stack.includes(lowerItem)
          );
          
          if (matchedStack && !lowerItem.includes('stack')) {
            // Normalize tech stack
            return matchedStack.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ') + ' Stack';
          } else if (lowerItem.includes('full stack') && !lowerItem.includes('stack development')) {
            // Normalize "Full Stack" variations
            if (lowerItem.includes('development')) {
              return 'Full Stack Development';
            }
            return 'Full Stack';
          }
          return item;
        });
        
        technologies = [...technologies, ...normalizedObvious];
        tools = tools.filter(tool => !obviousTechnologies.includes(tool));
        technologies = [...new Set(technologies)];
      }
      
      // Final AI verification: Ask AI to verify each remaining tool is actually a tool
      if (tools.length > 0) {
        try {
          const verifiedTools = await this.verifyToolsWithAI(tools, skills, technologies);
          tools = verifiedTools.validTools;
          skills = [...skills, ...verifiedTools.movedToSkills];
          technologies = [...technologies, ...verifiedTools.movedToTechnologies];
          
          // Remove duplicates after AI verification
          skills = [...new Set(skills)];
          tools = [...new Set(tools)];
          technologies = [...new Set(technologies)];
        } catch (error) {
          console.error('AI Tool Verification Error:', error);
          // Continue with tools as-is if AI verification fails
        }
      }
      
      // Final absolute cleanup: One more pass to catch anything that slipped through
      tools = tools.filter(tool => {
        const lowerTool = tool.toLowerCase();
        // Remove anything with "stack" in the name
        if (lowerTool.includes('stack')) {
          let normalized = tool;
          if (!lowerTool.includes('stack development')) {
            // Try to normalize
            const matchedStack = techStacks.find(stack => lowerTool.includes(stack));
            if (matchedStack) {
              normalized = matchedStack.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ') + ' Stack';
            }
          }
          if (!technologies.some(t => t.toLowerCase() === normalized.toLowerCase())) {
            technologies.push(normalized);
          }
          return false;
        }
        // Remove "Full Stack Development" or similar
        if (lowerTool.includes('full stack') || lowerTool.includes('fullstack')) {
          const normalized = lowerTool.includes('development') ? 'Full Stack Development' : 'Full Stack';
          if (!technologies.some(t => t.toLowerCase() === normalized.toLowerCase())) {
            technologies.push(normalized);
          }
          return false;
        }
        return true;
      });
      
      // Final deduplication
      technologies = [...new Set(technologies)];
      tools = [...new Set(tools)];
      
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
      console.error('CV Extraction Agent Error:', error);
      // Fallback to keyword-based extraction
      return this.fallbackExtraction(cvText);
    }
  }

  /**
   * Verify tools with AI - ask AI if each item is actually a tool
   * 
   * @param {Array} tools - Array of potential tools
   * @param {Array} skills - Current skills array
   * @param {Array} technologies - Current technologies array
   * @returns {Object} Verified categorization with validTools, movedToSkills, movedToTechnologies
   */
  async verifyToolsWithAI(tools, skills, technologies) {
    if (!tools || tools.length === 0) {
      return { validTools: [], movedToSkills: [], movedToTechnologies: [] };
    }

    const prompt = `You are a technical categorization expert. Analyze each item and determine if it's a TOOL, SKILL, or TECHNOLOGY.

CRITICAL DEFINITIONS:
- TOOL: Software applications, platforms, or services you USE for development/workflow/productivity (e.g., Git, GitHub, Figma, Firebase, VS Code, Postman, Jira, Slack, Docker, Vercel, Netlify, Photoshop, Notion)
- SKILL: Programming languages, frameworks, libraries, methodologies you KNOW/BUILD WITH (e.g., JavaScript, React, Next.js, Express, Angular, jQuery, Redux, TypeScript)
- TECHNOLOGY: Tech stacks, architectures, systems, patterns (e.g., MERN Stack, MEAN Stack, Microservices, REST API, CI/CD, Cloud Computing)

IMPORTANT EXAMPLES:
- "MERN" or "MERN Stack" = TECHNOLOGY (tech stack), NOT a tool
- "Full Stack" or "Full Stack Development" = TECHNOLOGY (methodology/approach), NOT a tool
- "Next.js" = SKILL (framework), NOT a tool
- "React" = SKILL (framework), NOT a tool
- "Firebase" = TOOL (platform/service), NOT a technology
- "GitHub" = TOOL (platform/service)
- "Vercel" = TOOL (platform/service)
- "Docker" = TOOL (software application)

CRITICAL RULES:
- Anything with "Stack" in the name = TECHNOLOGY (e.g., "MERN Stack", "MEAN Stack")
- Anything with "Full Stack" or "Full Stack Development" = TECHNOLOGY
- Anything with "Development" that refers to methodology = TECHNOLOGY (e.g., "Full Stack Development")
- Frameworks and libraries = SKILL (e.g., "Next.js", "React", "Express")
- Software applications, platforms, services = TOOL (e.g., "GitHub", "Firebase", "Vercel")

Items to verify:
${tools.map((tool, idx) => `${idx + 1}. ${tool}`).join('\n')}

For each item, return JSON with this structure:
{
  "items": [
    {
      "item": "item name exactly as provided",
      "category": "tool" or "skill" or "technology",
      "reason": "brief explanation"
    }
  ]
}

Return ONLY valid JSON, no markdown, no explanations.`;

    try {
      const verification = await aiService.generateStructuredJSON(prompt, {
        items: 'array'
      });

      const validTools = [];
      const movedToSkills = [];
      const movedToTechnologies = [];

      if (Array.isArray(verification.items)) {
        verification.items.forEach((item) => {
          const originalTool = tools.find(t => 
            t.toLowerCase() === item.item?.toLowerCase()
          );
          
          if (!originalTool) return;

          const category = (item.category || '').toLowerCase();
          
          if (category === 'tool') {
            validTools.push(originalTool);
          } else if (category === 'skill') {
            // Don't add if already in skills
            if (!skills.some(s => s.toLowerCase() === originalTool.toLowerCase())) {
              movedToSkills.push(originalTool);
            }
          } else if (category === 'technology') {
            // Normalize tech stacks and methodologies
            let normalized = originalTool;
            const lowerTool = originalTool.toLowerCase();
            const techStacks = ['mern', 'mean', 'mevn', 'lamp', 'lemp', 'jamstack'];
            const matchedStack = techStacks.find(stack => 
              lowerTool.includes(stack) || stack.includes(lowerTool)
            );
            
            if (matchedStack && !lowerTool.includes('stack')) {
              normalized = matchedStack.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ') + ' Stack';
            } else if (lowerTool.includes('full stack')) {
              // Normalize "Full Stack" variations
              if (lowerTool.includes('development')) {
                normalized = 'Full Stack Development';
              } else {
                normalized = 'Full Stack';
              }
            } else if (lowerTool.includes('stack') && !normalized.includes('Stack')) {
              // Ensure "Stack" is capitalized
              normalized = normalized.replace(/stack/i, 'Stack');
            }
            
            // Don't add if already in technologies
            if (!technologies.some(t => t.toLowerCase() === normalized.toLowerCase())) {
              movedToTechnologies.push(normalized);
            }
          } else {
            // If AI is uncertain, keep it as a tool (conservative approach)
            validTools.push(originalTool);
          }
        });
      }

      return {
        validTools,
        movedToSkills,
        movedToTechnologies,
      };
    } catch (error) {
      console.error('AI Tool Verification Error:', error);
      // If AI verification fails, return tools as-is
      return {
        validTools: tools,
        movedToSkills: [],
        movedToTechnologies: [],
      };
    }
  }

  /**
   * Validate if extracted items are actually skills
   * Filters out school names, years, degree names, etc.
   * 
   * @param {Array} skills - Array of extracted skills
   * @returns {Array} Validated skills array
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

  /**
   * Fallback extraction using keyword-based approach
   * Used when AI extraction fails
   * 
   * @param {String} cvText - CV/resume text content
   * @returns {Object} Extracted data with lower confidence
   */
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
       'Git', 'GitHub', 'GitLab', 'Bitbucket',
       'Figma', 'Adobe XD', 'Sketch', 'InVision', 'Zeplin',
       'VS Code', 'Visual Studio Code', 'Sublime', 'Atom', 'WebStorm', 'IntelliJ',
       'Postman', 'Insomnia', 'Swagger', 'API Client',
       'Jira', 'Trello', 'Asana', 'Notion', 'Confluence', 'Slack', 'Discord', 'Teams',
       'Docker', 'Kubernetes', 'Jenkins', 'CircleCI', 'Travis', 'GitHub Actions',
       'Chrome DevTools', 'Firefox DevTools', 'Safari DevTools',
       'npm', 'yarn', 'pnpm', 'Webpack', 'Vite', 'Parcel', 'Rollup',
       'Firebase', 'Vercel', 'Netlify', 'Heroku', 'AWS Console', 'Azure Portal', 'GCP Console',
       'Photoshop', 'Illustrator', 'Premiere', 'After Effects', 'Adobe Creative Suite',
       'Excel', 'Google Sheets', 'Airtable'
     ];
     
     // Technologies (stacks, architectures, systems) - NO databases, NO individual tools
     const techKeywords = [
       'MERN Stack', 'MEAN Stack', 'MEVN Stack', 'LAMP Stack', 'LEMP Stack', 'JAMStack',
       'Microservices', 'Monolithic', 'Serverless Architecture',
       'REST API', 'GraphQL', 'SOAP',
       'Cloud Computing', 'CI/CD', 'DevOps', 'Agile', 'Scrum'
     ];
     
     // Tech stacks that should NOT be in tools
     const techStackKeywords = ['mern', 'mean', 'mevn', 'lamp', 'lemp', 'jamstack', 'full stack', 'fullstack'];
     
     // Databases - EXCLUDE from all categories
     const databaseKeywords = [
       'MongoDB', 'MySQL', 'PostgreSQL', 'Redis', 'Elasticsearch',
       'SQLite', 'Oracle', 'SQL Server', 'Firebase Database', 'DynamoDB', 'Cassandra'
     ];
     
     let foundSkills = skillKeywords.filter(skill => 
       lowerText.includes(skill.toLowerCase()) &&
       !databaseKeywords.some(db => skill.toLowerCase().includes(db.toLowerCase()))
     );
     
     // Validate extracted skills
     foundSkills = this.validateSkills(foundSkills);
     
     let foundTools = toolKeywords.filter(tool => 
       lowerText.includes(tool.toLowerCase()) &&
       !foundSkills.some(skill => skill.toLowerCase() === tool.toLowerCase()) &&
       !databaseKeywords.some(db => tool.toLowerCase().includes(db.toLowerCase()))
     );
     
     // Remove tech stacks from tools (e.g., MERN should not be a tool)
     foundTools = foundTools.filter(tool => 
       !techStackKeywords.some(stack => tool.toLowerCase().includes(stack) || stack.includes(tool.toLowerCase()))
     );
     
     let foundTechnologies = techKeywords.filter(tech => 
       lowerText.includes(tech.toLowerCase()) &&
       !foundSkills.some(skill => skill.toLowerCase() === tech.toLowerCase()) &&
       !foundTools.some(tool => tool.toLowerCase() === tech.toLowerCase()) &&
       !databaseKeywords.some(db => tech.toLowerCase().includes(db.toLowerCase()))
     );
     
     // Also check for tech stacks mentioned in text (e.g., "MERN", "MEAN")
     techStackKeywords.forEach(stack => {
       const stackPattern = new RegExp(`\\b${stack}\\s*(?:stack)?`, 'i');
       if (stackPattern.test(cvText) && !foundTechnologies.some(tech => tech.toLowerCase().includes(stack))) {
         const normalized = stack.split(' ').map(word => 
           word.charAt(0).toUpperCase() + word.slice(1)
         ).join(' ') + ' Stack';
         foundTechnologies.push(normalized);
       }
     });
     
     // Final cleanup: Remove any tech stacks that might have been added to tools
     foundTools = foundTools.filter(tool => {
       const lowerTool = tool.toLowerCase();
       return !techStackKeywords.some(stack => 
         lowerTool === stack || 
         lowerTool.includes(stack) || 
         stack.includes(lowerTool) ||
         lowerTool.includes('stack')
       );
     });

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

module.exports = new CVExtractionAgent();

