# SDG-8 Backend API

A comprehensive backend API for a youth-oriented job discovery and skill-development platform aligned with **SDG 8 (Decent Work and Economic Growth)**. This platform uses AI-powered agents to provide personalized career guidance, job matching, CV assistance, and skill development recommendations.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [AI Agents](#-ai-agents)
- [Getting Started](#-getting-started)
- [API Endpoints](#-api-endpoints)
- [Data Models](#-data-models)
- [Services](#-services)
- [Admin Panel](#-admin-panel)
- [Web Scraping](#-web-scraping)
- [Architecture](#-architecture)
- [Environment Variables](#-environment-variables)
- [Testing](#-testing)
- [Deployment](#-deployment)

## ✨ Features

### Core Features
- **User Authentication & Authorization** - JWT-based authentication with role-based access control (Admin/User)
- **Job Discovery** - Browse and search jobs with intelligent matching
- **Skill-Based Recommendations** - AI-powered job and resource recommendations
- **CV/Resume Assistant** - Extract skills from CV, generate professional summaries, and create CV layouts
- **Career Roadmap Generator** - Personalized learning paths to target roles
- **CareerBot** - Conversational AI mentor with persistent conversation history
- **Skill Gap Analysis** - Identify missing skills and recommend learning resources
- **Job Application** - AI-generated cover letters and automated email applications
- **Admin Panel** - Complete CRUD operations for jobs, resources, skills, and users
- **Web Scraping** - Automated job scraping from bdjobs.com

### Advanced Features
- **Semantic Search** - ChromaDB integration for intelligent matching
- **Streaming Responses** - Real-time AI responses for better UX
- **Multi-language Support** - English and Bangla (Bengali)
- **Conversation Persistence** - All CareerBot conversations saved to database
- **Email Notifications** - Automated skill recommendations and job applications
- **Performance Optimizations** - Caching, parallel processing, optimized queries

## 🏛️ Tech Stack

### Core Technologies
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB object modeling
- **JWT (jsonwebtoken)** - Authentication tokens
- **bcryptjs** - Password hashing

### AI & ML Technologies
- **OpenAI API** / **OpenRouter** - AI text generation
- **ChromaDB** - Vector database for semantic search and embeddings
- **Puppeteer** - Web scraping
- **Cheerio** - HTML parsing

### Additional Libraries
- **nodemailer** - Email sending
- **multer** - File uploads (PDF CVs)
- **pdf-parse** - PDF text extraction
- **compression** - Response compression
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 🤖 AI Agents

The platform uses **8 specialized AI agents** for different tasks:

### 1. **CareerMentorAgent** (CareerBot)
**Purpose:** Conversational AI mentor for career guidance

**Key Features:**
- Answers career questions with context-aware responses
- Uses conversation history (persisted in database)
- Semantic search for jobs and resources via ChromaDB
- Personalized advice based on user profile
- Streaming responses for real-time chat
- Remembers previous conversations across sessions

**Main Methods:**
- `getContextualResponse(userId, userMessage)` - Get AI response
- `getContextualResponseStream(userId, userMessage, onChunk)` - Streaming response
- `loadConversationHistory(userId)` - Load conversation from database
- `saveMessage(userId, role, content)` - Save message to database
- `getAllMessages(userId)` - Get all conversation messages
- `clearHistory(userId)` - Clear conversation history

**Used In:** CareerBot chat interface (`/app/careerbot`)

---

### 2. **JobMatchPercentageAgent**
**Purpose:** Calculates intelligent match percentage between users and jobs

**Key Features:**
- Semantic similarity using ChromaDB embeddings
- Match formula: Skill Overlap (60%) + Experience (20%) + Track (20%)
- Identifies matched and missing skills
- Provides detailed match breakdown
- Embeds user profiles and jobs for semantic matching

**Main Methods:**
- `calculateMatchPercentage(similarity, user, job)` - Calculate 0-100% match
- `calculateSimilarity(user, job)` - Get semantic similarity score
- `embedJob(job)` - Embed job into ChromaDB
- `embedUser(user)` - Embed user profile into ChromaDB
- `getMatchBreakdown(similarity, user, job)` - Get detailed breakdown

**Used In:** Job recommendations, dashboard job matching

---

### 3. **CVExtractionAgent**
**Purpose:** Extracts structured information from CV/resume text

**Key Features:**
- Extracts: Skills, Tools, Technologies, Roles/Domains
- Validates and filters non-skill items (school names, years, etc.)
- Semantic normalization (e.g., "ReactJS" → "React")
- AI verification to ensure correct categorization
- Infers experience level from CV content
- Handles both text and PDF uploads

**Main Methods:**
- `extractSkillsFromCV(cvText, preferredTrack)` - Extract all information
- `normalizeSkillsWithEmbeddings(skills)` - Normalize using semantic matching
- `verifyToolsWithAI(tools, skills, technologies)` - AI verification

**Used In:** Profile page CV upload/extraction

---

### 4. **CVProfileAssistantAgent**
**Purpose:** Helps create professional CVs and improve online presence

**Key Features:**
- Generates professional summaries
- Suggests bullet points (CAR/STAR method)
- LinkedIn and portfolio recommendations
- Generates clean CV layouts (text format)
- Uses embeddings to find similar successful profiles
- Streaming support for real-time generation

**Main Methods:**
- `generateProfessionalSummary(userId)` - Generate summary
- `generateProfessionalSummaryStream(userId, onChunk)` - Streaming summary
- `suggestBulletPoints(userId, experience)` - Suggest bullet points
- `getLinkedInRecommendations(userId)` - Get recommendations
- `generateCVLayout(userId, options)` - Generate full CV

**Used In:** CV Assistant page (`/app/cv-assistant`)

---

### 5. **CareerRoadmapAgent**
**Purpose:** Generates personalized career roadmaps

**Key Features:**
- Step-by-step learning roadmaps with phases/months
- Specific topics, technologies, and project ideas
- Application timeline suggestions
- Saves and retrieves roadmaps for users
- Uses embeddings for semantic role matching
- Considers user's available hours per week

**Main Methods:**
- `generateRoadmap(userId, targetRole, timeframe, availableHours)` - Generate roadmap
- `getUserRoadmaps(userId)` - Get all user roadmaps
- `getRoadmap(roadmapId)` - Get specific roadmap
- `saveRoadmap(userId, targetRole, timeframe, roadmapData)` - Save roadmap
- `deleteRoadmap(roadmapId)` - Delete roadmap

**Used In:** Roadmap page (`/app/roadmap`)

---

### 6. **SkillGapAnalysisAgent**
**Purpose:** Identifies skill gaps and recommends learning resources

**Key Features:**
- Analyzes missing skills (exact + semantic matching)
- Prioritizes skill gaps based on job requirements
- Recommends learning resources from database
- Provides learning paths with time estimates
- Uses ChromaDB for semantic resource search

**Main Methods:**
- `analyzeSkillGaps(user, job)` - Analyze gaps
- `getLearningRecommendations(missingSkills, user)` - Get recommendations

**Used In:** Job detail pages, skill gap analysis

---

### 7. **JobApplicationAgent**
**Purpose:** Generates personalized cover letters for job applications

**Key Features:**
- AI-generated cover letters tailored to job and user profile
- Uses embeddings for better job analysis
- Finds similar jobs for context
- Removes placeholder text and headers
- Only includes available information (no placeholders)
- Sends application emails automatically

**Main Methods:**
- `generateCoverLetter(user, job)` - Generate cover letter
- `findSimilarJobs(job)` - Find similar jobs using embeddings

**Used In:** Job application feature (Apply Now button)

---

### 8. **SkillRecommendationAgent**
**Purpose:** Recommends skills based on current job market trends

**Key Features:**
- Analyzes user profiles against job market data
- Embeds user profiles and jobs into ChromaDB
- AI-powered analysis to determine necessary skills
- Sends personalized recommendations via email
- Processes all users in bulk

**Main Methods:**
- `analyzeUserSkills(user, preFetchedJobs)` - Analyze and recommend skills
- `embedUser(user)` - Embed user profile
- `getAllJobEmbeddings(userTrack, preFetchedJobs)` - Get job embeddings

**Used In:** Admin panel (bulk email to all users)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (local or cloud instance like MongoDB Atlas)
- **API Keys:**
  - OpenAI API key or OpenRouter API key
  - ChromaDB Cloud credentials (optional, defaults provided)
  - Email service credentials (for notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SDG-8
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   # MongoDB Connection
   MONGO_URI=mongodb://localhost:27017/sdg8
   
   # JWT Authentication
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=30d
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # AI Service (OpenRouter or OpenAI)
   OPENROUTER_API_KEY=your_openrouter_api_key
   # OR
   OPENAI_API_KEY=your_openai_api_key
   
   # ChromaDB Cloud (Optional - defaults provided)
   CHROMA_API_KEY=ck-9M44Hp1zskNDFvAE9fLrGyHnTdkseX7cZDuFgAD9VkeB
   CHROMA_TENANT=298d6e96-9463-4a9f-8569-b8c5bfb38c88
   CHROMA_DATABASE=transnova
   
   # Email Configuration (for contact form and notifications)
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   EMAIL_FROM=your-email@gmail.com
   ```

4. **Run the server**

   Development mode (with auto-reload):
   ```bash
   npm run dev
   ```

   Production mode:
   ```bash
   npm start
   ```

   The server will start on `http://localhost:5000` (or your specified PORT).

### Database Seeding

Seed the database with sample data:

```bash
# Seed admin user
npm run seed:admin

# Seed jobs only
npm run seed:jobs

# Seed resources only
npm run seed:resources

# Seed all (admin + jobs + resources)
npm run seed:all
```

**Default Admin Credentials:**
- Email: `admin@admin.com`
- Password: `admin1234`

## 📡 API Endpoints

### Authentication Routes (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login user |
| `GET` | `/api/auth/me` | Get current authenticated user (Protected) |

**Example: Register**
```http
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Example: Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "fullName": "John Doe",
    "email": "john@example.com"
  }
}
```

---

### User Routes (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/me` | Get current user profile |
| `PUT` | `/api/users/me` | Update user profile |
| `PATCH` | `/api/users/me/skills` | Update skills array |
| `PATCH` | `/api/users/me/interests` | Update career interests |
| `POST` | `/api/users/me/cv` | Store CV text |
| `POST` | `/api/users/me/save-job/:jobId` | Save a job |
| `POST` | `/api/users/me/save-resource/:resourceId` | Save a resource |

**Headers Required:**
```
Authorization: Bearer <jwt-token>
```

---

### Job Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/jobs` | Get all jobs (with filters) | No |
| `GET` | `/api/jobs/:id` | Get single job by ID | No |
| `POST` | `/api/jobs/:id/apply` | Apply to a job (AI-generated cover letter) | Yes |

**Query Parameters for GET /api/jobs:**
- `track` - Filter by track (e.g., "Web Development")
- `location` - Filter by location
- `type` - Filter by job type (Internship, Part-time, Full-time, Freelance)
- `experienceLevel` - Filter by experience level

**Example:**
```http
GET /api/jobs?track=Web%20Development&type=Full-time
```

---

### Resource Routes (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/resources` | Get all learning resources |
| `GET` | `/api/resources/:id` | Get single resource by ID |

---

### Recommendation Routes (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/recommendations/jobs` | Get job recommendations based on user skills |
| `GET` | `/api/recommendations/resources` | Get resource recommendations based on skills/interests |

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "jobId": "...",
      "job": { ... },
      "matchedSkills": ["React", "Node.js"],
      "missingSkills": ["TypeScript"],
      "matchScore": 0.75,
      "matchPercentage": 75
    }
  ]
}
```

---

### Dashboard Route (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard` | Get combined dashboard data |

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "recommendedJobs": { "count": 10, "jobs": [...] },
    "recommendedResources": { "count": 5, "resources": [...] },
    "savedJobs": [...],
    "appliedJobs": [...]
  }
}
```

---

### AI Routes (Protected)

All AI routes require authentication.

#### CV Extraction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/extract-cv` | Extract skills from CV text |
| `POST` | `/api/ai/upload-cv` | Upload and extract CV from PDF |
| `POST` | `/api/ai/verify-tools` | Verify tools with AI |

#### Career Roadmap
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/roadmap` | Generate career roadmap |
| `GET` | `/api/ai/roadmaps` | Get user roadmaps |
| `GET` | `/api/ai/roadmap/:roadmapId` | Get specific roadmap |
| `DELETE` | `/api/ai/roadmap/:roadmapId` | Delete roadmap |

#### CareerBot (Chat)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/chat` | Chat with CareerBot |
| `POST` | `/api/ai/chat-stream` | Chat with CareerBot (streaming) |
| `GET` | `/api/ai/chat-history` | Get conversation history |
| `DELETE` | `/api/ai/chat-history` | Clear conversation history |

#### CV / Profile Assistant
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/cv/summary` | Generate professional summary |
| `POST` | `/api/ai/cv/summary-stream` | Generate summary (streaming) |
| `POST` | `/api/ai/cv/bullet-points` | Suggest bullet points |
| `GET` | `/api/ai/cv/recommendations` | Get LinkedIn/Portfolio recommendations |
| `GET` | `/api/ai/cv/recommendations-stream` | Get recommendations (streaming) |
| `POST` | `/api/ai/cv/generate` | Generate CV layout |
| `POST` | `/api/ai/cv/generate-stream` | Generate CV (streaming) |

#### Job Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ai/job-match/:jobId` | Get enhanced job match analysis |

---

### Admin Routes (Protected - Admin Only)

All admin routes require authentication and admin role.

#### Jobs Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/jobs` | Get all jobs |
| `POST` | `/api/admin/jobs` | Create a job |
| `PUT` | `/api/admin/jobs/:id` | Update a job |
| `DELETE` | `/api/admin/jobs/:id` | Delete a job |

#### Resources Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/resources` | Get all resources |
| `POST` | `/api/admin/resources` | Create a resource |
| `PUT` | `/api/admin/resources/:id` | Update a resource |
| `DELETE` | `/api/admin/resources/:id` | Delete a resource |

#### Skills & Domains
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/skills` | Get all skills and domains |
| `POST` | `/api/admin/domains` | Add a domain |
| `DELETE` | `/api/admin/domains` | Remove a domain |

#### Users Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | Get all users |
| `GET` | `/api/admin/users/:id` | Get user by ID |

#### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/send-skill-recommendations` | Send skill recommendations to all users |
| `POST` | `/api/admin/scrape-bdjobs` | Scrape jobs from bdjobs.com |

**Example: Scrape Jobs**
```http
POST /api/admin/scrape-bdjobs
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "maxJobs": 50
}
```

---

### Contact Route (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/contact/send` | Send contact form message via email |

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Inquiry",
  "message": "Hello, I have a question..."
}
```

---

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |

---

## 📊 Data Models

### User Model

```javascript
{
  fullName: String (required),
  email: String (unique, required, lowercase),
  password: String (required, hashed, select: false),
  role: "user" | "admin" (default: "user"),
  educationLevel: String,
  experienceLevel: "Fresher" | "Junior" | "Mid" (default: "Fresher"),
  preferredTrack: String,
  skills: [String],
  experiences: [String],
  careerInterests: [String],
  cvText: String,
  savedJobs: [ObjectId] (ref: "Job"),
  appliedJobs: [ObjectId] (ref: "Job"),
  savedResources: [ObjectId] (ref: "Resource"),
  createdAt: Date,
  updatedAt: Date
}
```

### Job Model

```javascript
{
  title: String (required),
  company: String (required),
  location: String (required),
  requiredSkills: [String],
  experienceLevel: String (required),
  jobType: "Internship" | "Part-time" | "Full-time" | "Freelance" (required),
  track: String (required),
  email: String (optional, for job applications),
  source: "manual" | "bdjobs.com" | "other" (default: "manual"),
  sourceUrl: String (optional, original job link),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `track`
- `location`
- `jobType`
- `experienceLevel`

### Resource Model

```javascript
{
  title: String (required),
  platform: String (required),
  url: String (required),
  type: String,
  relatedSkills: [String],
  cost: "Free" | "Paid" (default: "Free"),
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Roadmap Model

```javascript
{
  userId: ObjectId (required, ref: "User"),
  targetRole: String (required),
  timeframe: Number (required, in months),
  phases: [{
    title: String,
    duration: Number,
    objectives: [String],
    skillsToLearn: [String],
    projects: [String],
    milestones: [String],
    resources: [String]
  }],
  applicationTimeline: {
    months: Number,
    milestones: [String]
  },
  portfolioTips: [String],
  interviewPrep: [String],
  generatedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Conversation Model

```javascript
{
  userId: ObjectId (required, ref: "User", indexed),
  messages: [{
    role: "user" | "assistant" | "system" (required),
    content: String (required),
    timestamp: Date (default: Date.now)
  }],
  lastMessageAt: Date (indexed),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔧 Services

### Core Services

#### `aiService.js`
- Handles AI text generation (OpenAI/OpenRouter)
- Supports streaming responses
- Prompt caching for performance
- Schema validation

#### `chromaService.js`
- ChromaDB connection and management
- Vector embeddings storage
- Semantic search functionality
- Collection management

#### `emailService.js`
- Sends job application emails
- Sends skill recommendation emails
- HTML and plain text email support
- Nodemailer integration

#### `pdfService.js`
- Extracts text from PDF files
- Handles CV/resume PDFs
- Error handling for corrupted files

#### `recommendationService.js`
- Job recommendation logic
- Resource recommendation logic
- Match scoring algorithms

#### `aiJobMatchingService.js`
- Fast rule-based matching for dashboard
- AI-powered matching for detailed analysis
- Hybrid approach (semantic + keyword)

#### `bdjobsScraper.js`
- Web scraping from bdjobs.com
- Job data extraction
- Skill extraction using AI
- Duplicate detection

---

## 👨‍💼 Admin Panel

The admin panel provides complete control over the platform:

### Features
- **Jobs Management** - Create, read, update, delete jobs
- **Resources Management** - Manage learning resources
- **Skills & Domains** - Add/remove career domains
- **Users Management** - View all users and their information
- **AI Skill Recommendations** - Send personalized skill recommendations to all users via email
- **Web Scraping** - Scrape jobs from bdjobs.com

### Access
- **URL:** `/admin-panel` (separate route from main app)
- **Credentials:**
  - Email: `admin@admin.com`
  - Password: `admin1234`

### Security
- Separate route from main application
- Role-based access control (admin only)
- JWT authentication required

---

## 🕷️ Web Scraping

### Bdjobs.com Scraper

The platform includes a web scraper to fetch jobs from [bdjobs.com](https://bdjobs.com/).

**Features:**
- Automated job extraction
- Skill extraction using AI
- Automatic categorization
- Duplicate detection
- Email extraction from job pages

**Usage:**
1. Go to Admin Panel
2. Click "Scrape Jobs from Bdjobs.com"
3. Enter number of jobs to scrape (1-200)
4. Wait for scraping to complete
5. Jobs are automatically added to database

**How It Works:**
1. Uses Puppeteer to navigate to bdjobs.com
2. Extracts job data (title, company, location, etc.)
3. Uses AI agent to extract skills from job descriptions
4. Maps categories to your track system
5. Saves jobs to database (skips duplicates)

**Note:** Ensure compliance with bdjobs.com's Terms of Service and robots.txt.

---

## 🏗️ Architecture

### Project Structure

```
SDG-8/
├── src/
│   ├── agents/              # AI agents (8 agents)
│   │   ├── careerMentorAgent.js
│   │   ├── jobMatchPercentageAgent.js
│   │   ├── cvExtractionAgent.js
│   │   ├── cvProfileAssistantAgent.js
│   │   ├── careerRoadmapAgent.js
│   │   ├── skillGapAnalysisAgent.js
│   │   ├── jobApplicationAgent.js
│   │   ├── skillRecommendationAgent.js
│   │   └── index.js
│   ├── config/               # Configuration files
│   │   └── database.js
│   ├── controllers/          # Route controllers
│   │   ├── adminController.js
│   │   ├── aiController.js
│   │   ├── authController.js
│   │   ├── contactController.js
│   │   ├── dashboardController.js
│   │   ├── jobController.js
│   │   ├── recommendationController.js
│   │   ├── resourceController.js
│   │   └── userController.js
│   ├── middleware/          # Custom middleware
│   │   ├── authenticateJWT.js
│   │   ├── errorHandler.js
│   │   └── isAdmin.js
│   ├── models/              # MongoDB models
│   │   ├── User.js
│   │   ├── Job.js
│   │   ├── Resource.js
│   │   ├── Roadmap.js
│   │   └── Conversation.js
│   ├── routes/              # Express routes
│   │   ├── adminRoutes.js
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── contactRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── jobRoutes.js
│   │   ├── recommendationRoutes.js
│   │   ├── resourceRoutes.js
│   │   └── userRoutes.js
│   ├── services/            # Business logic services
│   │   ├── aiService.js
│   │   ├── aiJobMatchingService.js
│   │   ├── bdjobsScraper.js
│   │   ├── chromaService.js
│   │   ├── cvExtractionService.js
│   │   ├── emailService.js
│   │   ├── pdfService.js
│   │   ├── recommendationService.js
│   │   ├── roadmapService.js
│   │   └── skillGapService.js
│   ├── seed/                # Database seed scripts
│   │   ├── admin.js
│   │   ├── jobs.js
│   │   └── resources.js
│   └── utils/               # Utility functions
│       └── validateObjectId.js
├── app.js                   # Express app configuration
├── server.js                # Server entry point
├── package.json
└── .env                     # Environment variables
```

### Request Flow

1. **Request** → Express Router
2. **Middleware** → Authentication, Validation
3. **Controller** → Business logic
4. **Service** → External API calls, database operations
5. **Agent** → AI processing (if needed)
6. **Response** → JSON response to client

### AI Agent Flow

1. User request → Controller
2. Controller → Agent
3. Agent → ChromaDB (for embeddings)
4. Agent → AI Service (for text generation)
5. Agent → Database (save results)
6. Agent → Controller (return response)

---

## 🔐 Authentication & Security

### JWT Authentication

1. User registers/logs in
2. Password is hashed using bcryptjs (salt rounds: 10)
3. Backend generates JWT token
4. Token expires after 30 days (configurable)
5. Frontend stores token and sends in `Authorization: Bearer <token>` header
6. Backend verifies token on protected routes

### Security Features

- Password hashing with bcryptjs
- JWT token expiration
- Passwords never returned in API responses
- Role-based access control (Admin/User)
- Input validation
- Error handling without exposing sensitive data

### Protected Routes

All routes except the following require authentication:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/jobs`
- `GET /api/jobs/:id`
- `GET /api/resources`
- `GET /api/resources/:id`
- `POST /api/contact/send`
- `GET /health`

---

## 📝 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGO_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | - |
| `JWT_EXPIRE` | JWT token expiration | No | `30d` |
| `PORT` | Server port | No | `5000` |
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes* | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes* | - |
| `CHROMA_API_KEY` | ChromaDB Cloud API key | No | Default provided |
| `CHROMA_TENANT` | ChromaDB tenant ID | No | Default provided |
| `CHROMA_DATABASE` | ChromaDB database name | No | `transnova` |
| `EMAIL_SERVICE` | Email service provider | No | `gmail` |
| `EMAIL_USER` | Email address for sending | Yes** | - |
| `EMAIL_PASSWORD` | Email password/app password | Yes** | - |
| `EMAIL_FROM` | From email address | No | `EMAIL_USER` |

\* Either `OPENROUTER_API_KEY` or `OPENAI_API_KEY` is required  
\** Required if using email features

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in verbose mode
npm run test:verbose
```

### Test Structure

```
tests/
├── integration/     # Integration tests
│   ├── auth.test.js
│   ├── dashboard.test.js
│   ├── jobs.test.js
│   └── ...
└── unit/            # Unit tests
    └── recommendationService.test.js
```

---

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   - Set all required environment variables
   - Use strong `JWT_SECRET`
   - Configure production MongoDB URI
   - Set `NODE_ENV=production`

2. **Database**
   - Ensure MongoDB is accessible
   - Run migrations if needed
   - Seed initial data if required

3. **Performance**
   - Enable response compression
   - Configure connection pooling
   - Set up caching if needed
   - Monitor API response times

4. **Security**
   - Use HTTPS
   - Validate all inputs
   - Rate limiting (consider adding)
   - CORS configuration

### Example Deployment (Vercel)

The project includes `vercel.json` for Vercel deployment:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

---

## 📚 Additional Documentation

- **ENV_SETUP.md** - Detailed environment variable setup
- **document.md** - Detailed API documentation
- **PART2_IMPLEMENTATION.md** - Implementation details

---

## 🤝 Contributing

This is a backend API for SDG-8 aligned platform. Ensure all code follows the existing structure and patterns.

### Code Style
- Use async/await for asynchronous operations
- Follow existing error handling patterns
- Add comments for complex logic
- Maintain consistent naming conventions

---

## 📄 License

ISC

---

## 🆘 Support

For issues or questions, please contact:
- Email: shafinahnam89@gmail.com
- Email: ashikpullock99@gmail.com

---

## 🎯 Key Features Summary

✅ **8 AI Agents** - Specialized agents for different tasks  
✅ **Semantic Search** - ChromaDB integration for intelligent matching  
✅ **Streaming Responses** - Real-time AI responses  
✅ **Conversation Persistence** - All chats saved to database  
✅ **Multi-language** - English and Bangla support  
✅ **Admin Panel** - Complete CRUD operations  
✅ **Web Scraping** - Automated job fetching from bdjobs.com  
✅ **Email Automation** - Job applications and skill recommendations  
✅ **Performance Optimized** - Caching, parallel processing, optimized queries  
✅ **Production Ready** - Error handling, validation, security measures  

---

**Built with ❤️ for SDG 8: Decent Work and Economic Growth**
