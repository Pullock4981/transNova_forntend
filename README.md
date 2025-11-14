# SDG-8 Backend API

A complete backend API for a youth-oriented job discovery and skill-development platform aligned with **SDG 8 (Decent Work and Economic Growth)**.

## 🏛️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB object modeling
- **JWT (jsonwebtoken)** - Authentication tokens
- **bcryptjs** - Password hashing
- **nodemailer** - Email sending for contact form
- **dotenv** - Environment variable management
- **CORS** - Cross-origin resource sharing
- **Nodemon** - Development server (dev only)

## 📁 Folder Structure

```
/src
  /config          # Configuration files (database)
  /models          # MongoDB models (User, Job, Resource)
  /controllers     # Route controllers
  /routes          # Express routes
  /middleware      # Custom middleware (auth, error handling)
  /services        # Business logic (recommendation engine)
  /utils           # Utility functions
  /seed            # Database seed scripts
app.js             # Express app configuration
server.js          # Server entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SDG-8
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=mongodb://localhost:27017/sdg8
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=30d
   PORT=5000
   
   # Email Configuration (for contact form)
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   ```

   **Note:** 
   - `JWT_SECRET` should be a long, random string. Use a strong secret in production!
   - For Gmail, you'll need to use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password. Enable 2-Step Verification first, then generate an App Password.

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

## 🌱 Database Seeding

Seed the database with sample jobs and resources:

```bash
# Seed jobs only
npm run seed:jobs

# Seed resources only
npm run seed:resources

# Seed both
npm run seed:all
```

## 📡 API Endpoints

### Authentication

The backend uses **JWT (JSON Web Tokens)** for authentication.

#### Register a new user:
```http
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login:
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

Both endpoints return a JWT token that should be used for protected routes:
```
Authorization: Bearer <jwt-token>
```

### Auth Routes (Public)

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current authenticated user (Protected)

### User Routes (Protected)

- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `PATCH /api/users/me/skills` - Update skills array
- `PATCH /api/users/me/interests` - Update career interests
- `POST /api/users/me/cv` - Store CV text
- `POST /api/users/me/save-job/:jobId` - Save a job
- `POST /api/users/me/save-resource/:resourceId` - Save a resource

### Job Routes (Public)

- `GET /api/jobs` - Get all jobs
  - Query params: `track`, `location`, `type`, `experienceLevel`
- `GET /api/jobs/:id` - Get single job by ID

### Resource Routes (Public)

- `GET /api/resources` - Get all learning resources
- `GET /api/resources/:id` - Get single resource by ID

### Recommendation Routes (Protected)

- `GET /api/recommendations/jobs` - Get job recommendations based on user skills
- `GET /api/recommendations/resources` - Get resource recommendations based on skills/interests

### Dashboard Route (Protected)

- `GET /api/dashboard` - Get combined dashboard data (profile, recommendations, saved items)

### Contact Route (Public)

- `POST /api/contact/send` - Send contact form message via email
  - Body: `{ name: String, email: String, subject: String, message: String }`
  - Sends email to configured recipient addresses (shafinahnam89@gmail.com, ashikpullock99@gmail.com)

### Health Check

- `GET /health` - Server health check

## 🔐 JWT Authentication

This backend implements **JWT (JSON Web Token)** authentication with password hashing using bcryptjs.

### How it works:

1. User registers with email and password
2. Password is hashed using bcryptjs before storing in database
3. User logs in with email and password
4. Backend verifies credentials and generates a JWT token
5. Frontend stores the token and sends it in `Authorization: Bearer <token>` header
6. Backend verifies token using JWT middleware
7. Backend attaches user info to `req.user`

### Security Features:

- Passwords are hashed using bcryptjs (salt rounds: 10)
- JWT tokens expire after 30 days (configurable via `JWT_EXPIRE`)
- Passwords are never returned in API responses
- Token verification on every protected route

## 📊 Data Models

### User Model

```javascript
{
  fullName: String (required),
  email: String (unique, required),
  password: String (required, hashed),
  educationLevel: String,
  experienceLevel: "Fresher" | "Junior" | "Mid",
  preferredTrack: String,
  skills: [String],
  experiences: [String],
  careerInterests: [String],
  cvText: String,
  savedJobs: [ObjectId],
  savedResources: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Job Model

```javascript
{
  title: String,
  company: String,
  location: String,
  requiredSkills: [String],
  experienceLevel: String,
  jobType: "Internship" | "Part-time" | "Full-time" | "Freelance",
  track: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Resource Model

```javascript
{
  title: String,
  platform: String,
  url: String,
  relatedSkills: [String],
  cost: "Free" | "Paid",
  createdAt: Date,
  updatedAt: Date
}
```

## 🎯 Recommendation Engine

The recommendation engine uses **rule-based matching** (non-AI):

### Job Recommendations

- Compares user skills with job required skills
- Returns jobs with at least 1 matching skill
- Includes match details:
  - `matchedSkills`: Skills user has that match job requirements
  - `missingSkills`: Skills required by job that user doesn't have
  - `matchScore`: Ratio of matched skills to total required skills

### Resource Recommendations

- Matches user skills and career interests with resource related skills
- Returns resources with at least 1 match
- Includes match details and score

## 🛠️ Development

### Project Structure Details

- **`/config`**: Database and Firebase initialization
- **`/models`**: Mongoose schemas
- **`/controllers`**: Request handlers
- **`/routes`**: Express route definitions
- **`/middleware`**: Custom middleware (auth, error handling, validation)
- **`/services`**: Business logic (recommendation algorithms)
- **`/utils`**: Helper functions
- **`/seed`**: Database seeding scripts

### Error Handling

All errors are handled by the global error handler middleware. Errors return:

```json
{
  "success": false,
  "message": "Error message",
  "stack": "..." // Only in development
}
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | Yes |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | Yes |
| `PORT` | Server port (default: 5000) | No |

## 🧪 Testing the API

### Example: Get Current User Profile

```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Example: Get Jobs with Filters

```bash
curl -X GET "http://localhost:5000/api/jobs?track=Web%20Development&type=Full-time"
```

### Example: Get Recommendations

```bash
curl -X GET http://localhost:5000/api/recommendations/jobs \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## 📚 Additional Documentation

See `document.md` for detailed API documentation, request/response examples, and architecture details.

## 🤝 Contributing

This is a backend API for SDG-8 aligned platform. Ensure all code follows the existing structure and patterns.

## 📄 License

ISC

