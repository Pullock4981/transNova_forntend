# SDG-8 Backend API Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [API Reference](#api-reference)
5. [Data Models](#data-models)
6. [Recommendation Engine](#recommendation-engine)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Overview

This backend API powers a youth-oriented job discovery and skill-development platform aligned with **SDG 8 (Decent Work and Economic Growth)**. The platform helps young people discover job opportunities and learning resources tailored to their skills and interests.

### Key Features

- **JWT Authentication** - Secure token-based authentication with password hashing
- **User Profile Management** - Complete user profiles with skills, interests, and CV
- **Job Discovery** - Browse and filter job listings
- **Learning Resources** - Access curated learning materials
- **Smart Recommendations** - Rule-based job and resource recommendations
- **Personal Dashboard** - Unified view of profile, recommendations, and saved items

---

## Architecture

### Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken) + bcryptjs
- **Environment**: dotenv for configuration

### Project Structure

```
SDG-8/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Job.js               # Job schema
│   │   └── Resource.js          # Learning resource schema
│   ├── controllers/
│   │   ├── userController.js    # User CRUD operations
│   │   ├── jobController.js     # Job operations
│   │   ├── resourceController.js # Resource operations
│   │   ├── recommendationController.js # Recommendation endpoints
│   │   └── dashboardController.js # Dashboard endpoint
│   ├── routes/
│   │   ├── authRoutes.js        # Authentication routes
│   │   ├── userRoutes.js        # User routes
│   │   ├── jobRoutes.js         # Job routes
│   │   ├── resourceRoutes.js    # Resource routes
│   │   ├── recommendationRoutes.js # Recommendation routes
│   │   └── dashboardRoutes.js   # Dashboard route
│   ├── middleware/
│   │   ├── authenticateJWT.js  # JWT authentication middleware
│   │   └── errorHandler.js      # Global error handler
│   ├── controllers/
│   │   ├── authController.js    # Authentication (register, login)
│   ├── services/
│   │   └── recommendationService.js # Recommendation logic
│   ├── utils/
│   │   └── validateObjectId.js  # MongoDB ObjectId validation
│   └── seed/
│       ├── jobs.js               # Job seed script
│       └── resources.js          # Resource seed script
├── app.js                        # Express app configuration
├── server.js                     # Server entry point
├── package.json                  # Dependencies and scripts
└── .env                          # Environment variables
```

### Request Flow

```
Client Request
    ↓
Express Middleware (CORS, JSON parser)
    ↓
Route Handler
    ↓
Authentication Middleware (if protected)
    ↓
Controller
    ↓
Service (if needed)
    ↓
Model/Database
    ↓
Response
```

---

## Authentication

### JWT Authentication Flow

The backend uses **JWT (JSON Web Tokens)** for authentication with password hashing using bcryptjs.

#### How It Works

1. **User Registration**: User provides email, password, and fullName
2. **Password Hashing**: Password is hashed using bcryptjs (10 salt rounds) before storing
3. **User Login**: User provides email and password
4. **Token Generation**: Backend verifies credentials and generates JWT token
5. **Token Usage**: Frontend stores token and sends it in `Authorization: Bearer <token>` header
6. **Token Verification**: Backend verifies token using JWT middleware
7. **User Info**: Backend extracts user info and attaches to `req.user`

#### Protected Routes

Routes that require authentication use the `authenticateJWT` middleware:

```javascript
router.use(authenticateJWT);
```

#### Token Verification

The middleware:
- Extracts token from `Authorization: Bearer <token>` header
- Verifies token with JWT using `JWT_SECRET`
- Fetches user from database
- Attaches user info to `req.user`:
  ```javascript
  {
    userId: "mongodb-user-id",
    email: "user@example.com",
    name: "User Name"
  }
  ```
- Returns 401 if token is missing, invalid, or expired

#### Security Features

- Passwords are hashed using bcryptjs (salt rounds: 10)
- JWT tokens expire after 30 days (configurable via `JWT_EXPIRE`)
- Passwords are never returned in API responses (using `select: false`)
- Token verification on every protected route

#### Example Requests

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","email":"john@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Protected Route:**
```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## API Reference

### Base URL

```
http://localhost:5000/api
```

### Response Format

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "count": 10  // Optional, for list responses
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message"
}
```

---

### Auth Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "email": "john@example.com",
      "skills": [],
      "careerInterests": [],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login User

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** Same format as register, includes user and token

#### Get Current Authenticated User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:** Same as GET `/api/users/me`

---

### User Endpoints

#### Get Current User Profile

```http
GET /api/users/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john@example.com",
    "educationLevel": "Bachelor's",
    "experienceLevel": "Junior",
    "preferredTrack": "Web Development",
    "skills": ["JavaScript", "React", "Node.js"],
    "experiences": ["Intern at TechCorp"],
    "careerInterests": ["Full Stack Development"],
    "cvText": "Experienced developer...",
    "savedJobs": [...],
    "savedResources": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Update User Profile

```http
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "John Doe",
  "educationLevel": "Master's",
  "experienceLevel": "Mid",
  "preferredTrack": "Backend Development",
  "experiences": ["Senior Developer at TechCorp"],
  "careerInterests": ["Cloud Computing"],
  "cvText": "Updated CV text..."
}
```

**Response:** Same as GET `/api/users/me`

#### Update Skills

```http
PATCH /api/users/me/skills
Authorization: Bearer <token>
Content-Type: application/json

{
  "skills": ["JavaScript", "TypeScript", "React", "Node.js", "MongoDB"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "skills": ["JavaScript", "TypeScript", "React", "Node.js", "MongoDB"],
    ...
  }
}
```

#### Update Career Interests

```http
PATCH /api/users/me/interests
Authorization: Bearer <token>
Content-Type: application/json

{
  "careerInterests": ["Full Stack Development", "DevOps", "Cloud Computing"]
}
```

#### Store CV Text

```http
POST /api/users/me/cv
Authorization: Bearer <token>
Content-Type: application/json

{
  "cvText": "Full CV text content here..."
}
```

#### Save Job

```http
POST /api/users/me/save-job/:jobId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "job-id-1",
      "title": "Frontend Developer",
      ...
    },
    {
      "_id": "job-id-2",
      "title": "Backend Developer",
      ...
    }
  ]
}
```

#### Save Resource

```http
POST /api/users/me/save-resource/:resourceId
Authorization: Bearer <token>
```

---

### Job Endpoints

#### Get All Jobs

```http
GET /api/jobs?track=Web Development&location=Remote&type=Full-time&experienceLevel=Junior
```

**Query Parameters:**
- `track` (optional): Filter by track (case-insensitive partial match)
- `location` (optional): Filter by location (case-insensitive partial match)
- `type` (optional): Filter by job type (`Internship`, `Part-time`, `Full-time`, `Freelance`)
- `experienceLevel` (optional): Filter by experience level (case-insensitive partial match)

**Response:**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Frontend Developer",
      "company": "TechStart Inc.",
      "location": "Remote",
      "requiredSkills": ["HTML", "CSS", "JavaScript", "React"],
      "experienceLevel": "Junior",
      "jobType": "Full-time",
      "track": "Web Development",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    ...
  ]
}
```

#### Get Job by ID

```http
GET /api/jobs/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Frontend Developer",
    ...
  }
}
```

---

### Resource Endpoints

#### Get All Resources

```http
GET /api/resources
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Complete Web Development Bootcamp",
      "platform": "Udemy",
      "url": "https://www.udemy.com/web-development-bootcamp",
      "relatedSkills": ["HTML", "CSS", "JavaScript", "React", "Node.js"],
      "cost": "Paid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    ...
  ]
}
```

#### Get Resource by ID

```http
GET /api/resources/:id
```

---

### Recommendation Endpoints

#### Get Job Recommendations

```http
GET /api/recommendations/jobs
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "jobId": "507f1f77bcf86cd799439011",
      "job": {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Frontend Developer",
        "company": "TechStart Inc.",
        "requiredSkills": ["HTML", "CSS", "JavaScript", "React", "TypeScript"],
        ...
      },
      "matchedSkills": ["JavaScript", "React"],
      "missingSkills": ["TypeScript"],
      "matchScore": 0.4
    },
    ...
  ]
}
```

**Algorithm:**
- Compares user skills with job required skills (case-insensitive)
- Returns jobs with at least 1 matching skill
- Sorted by match score (descending)
- Match score = matched skills / total required skills

#### Get Resource Recommendations

```http
GET /api/recommendations/resources
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "resourceId": "507f1f77bcf86cd799439011",
      "resource": {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Complete Web Development Bootcamp",
        "relatedSkills": ["HTML", "CSS", "JavaScript", "React"],
        ...
      },
      "matchedItems": ["JavaScript", "React"],
      "matchScore": 0.5
    },
    ...
  ]
}
```

**Algorithm:**
- Matches user skills AND career interests with resource related skills
- Returns resources with at least 1 match
- Sorted by match score (descending)

---

### Dashboard Endpoint

#### Get Dashboard Data

```http
GET /api/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "email": "john@example.com",
      "educationLevel": "Bachelor's",
      "experienceLevel": "Junior",
      "preferredTrack": "Web Development",
      "skills": ["JavaScript", "React"],
      "careerInterests": ["Full Stack Development"]
    },
    "recommendedJobs": {
      "count": 8,
      "jobs": [...]
    },
    "recommendedResources": {
      "count": 12,
      "resources": [...]
    },
    "savedJobs": [...],
    "savedResources": [...]
  }
}
```

---

## Data Models

### User Model

```javascript
{
  fullName: String (required),
  email: String (required, unique, lowercase),
  password: String (required, hashed, select: false),
  educationLevel: String,
  experienceLevel: "Fresher" | "Junior" | "Mid" (default: "Fresher"),
  preferredTrack: String,
  skills: [String],
  experiences: [String],
  careerInterests: [String],
  cvText: String,
  savedJobs: [ObjectId] (ref: "Job"),
  savedResources: [ObjectId] (ref: "Resource"),
  createdAt: Date (auto),
  updatedAt: Date (auto)
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
  createdAt: Date (auto),
  updatedAt: Date (auto)
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
  relatedSkills: [String],
  cost: "Free" | "Paid" (required),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
- `relatedSkills`
- `cost`

---

## Recommendation Engine

### Overview

The recommendation engine uses **rule-based matching** (non-AI). It compares user attributes (skills, interests) with job/resource requirements and calculates match scores.

### Job Recommendation Algorithm

1. **Input**: User ID
2. **Process**:
   - Fetch user profile
   - Fetch all jobs
   - For each job:
     - Find matching skills (case-insensitive comparison)
     - Calculate missing skills
     - Calculate match score: `matchedSkills.length / requiredSkills.length`
     - Include if `matchedSkills.length > 0`
3. **Output**: Sorted array (by match score, descending)

**Example:**
- User skills: `["JavaScript", "React", "Node.js"]`
- Job required: `["JavaScript", "React", "TypeScript", "HTML"]`
- Matched: `["JavaScript", "React"]`
- Missing: `["TypeScript", "HTML"]`
- Score: `2/4 = 0.5`

### Resource Recommendation Algorithm

1. **Input**: User ID
2. **Process**:
   - Fetch user profile
   - Combine user skills and career interests
   - Fetch all resources
   - For each resource:
     - Find matching items (case-insensitive comparison)
     - Calculate match score: `matchedItems.length / relatedSkills.length`
     - Include if `matchedItems.length > 0`
3. **Output**: Sorted array (by match score, descending)

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "stack": "..." // Only in development mode
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `500` - Internal Server Error

### Error Types Handled

1. **CastError** (Invalid ObjectId) → 404
2. **Duplicate Key** (MongoDB) → 400
3. **Validation Error** (Mongoose) → 400
4. **JWT Token Error** → 401
5. **Generic Errors** → 500

### Example Error Responses

**Invalid Token:**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

**Resource Not Found:**
```json
{
  "success": false,
  "message": "Job not found"
}
```

**Validation Error:**
```json
{
  "success": false,
  "message": "Skills must be an array"
}
```

---

## Best Practices

### Security

1. **Never expose JWT secret** - Use environment variables
2. **Always validate ObjectIds** - Use `validateObjectId` middleware
3. **Sanitize user input** - Mongoose handles basic sanitization
4. **Use HTTPS in production** - Never send tokens over HTTP

### Performance

1. **Use indexes** - Already implemented on frequently queried fields
2. **Populate selectively** - Only populate when needed
3. **Limit results** - Consider pagination for large datasets (future enhancement)

### Code Organization

1. **Separation of concerns** - Controllers, services, models are separate
2. **Reusable middleware** - Authentication, validation, error handling
3. **Consistent error handling** - Global error handler for all routes
4. **Environment-based config** - Use `.env` for all sensitive data

### API Design

1. **RESTful conventions** - Use appropriate HTTP methods
2. **Consistent response format** - All responses follow same structure
3. **Clear error messages** - Helpful error messages for debugging
4. **Versioning ready** - Easy to add `/api/v1` prefix if needed

### Future Enhancements

1. **Pagination** - For jobs and resources lists
2. **Search functionality** - Full-text search for jobs/resources
3. **AI-powered recommendations** - Replace rule-based with ML models
4. **Rate limiting** - Prevent API abuse
5. **Caching** - Redis for frequently accessed data
6. **Webhooks** - Notify users of new matching jobs
7. **Analytics** - Track recommendation effectiveness

---

## Development Workflow

### Running Locally

1. Start MongoDB: `mongod` (or use MongoDB Atlas)
2. Set up `.env` file
3. Run `npm install`
4. Run `npm run dev` (development) or `npm start` (production)
5. Seed database: `npm run seed:all`

### Testing Endpoints

Use tools like:
- **Postman** - GUI for API testing
- **curl** - Command-line testing
- **Thunder Client** - VS Code extension

### Debugging

- Check MongoDB connection logs
- Verify JWT secret is set
- Check token format in Authorization header
- Review error stack traces (development mode)

---

## Conclusion

This backend API provides a solid foundation for a job discovery and skill-development platform. The architecture is modular, scalable, and ready for future enhancements like AI-powered recommendations and advanced features.

For questions or issues, refer to the codebase comments or create an issue in the repository.

