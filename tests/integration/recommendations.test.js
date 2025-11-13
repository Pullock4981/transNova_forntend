const request = require('supertest');
const app = require('../../app');
const User = require('../../src/models/User');
const Job = require('../../src/models/Job');
const Resource = require('../../src/models/Resource');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');
const { createTestUser, getAuthHeader } = require('../helpers/authHelper');

describe('Recommendation Routes', () => {
  let user, token;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create test user with skills
    const testUser = await createTestUser({
      skills: ['JavaScript', 'React', 'Node.js'],
      careerInterests: ['Web Development', 'Full Stack'],
    });
    user = testUser.user;
    token = testUser.token;

    // Create jobs
    await Job.create([
      {
        title: 'Frontend Developer',
        company: 'Tech Corp',
        location: 'Remote',
        requiredSkills: ['JavaScript', 'React', 'HTML', 'CSS'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Web Development',
      },
      {
        title: 'Backend Developer',
        company: 'Cloud Inc',
        location: 'Remote',
        requiredSkills: ['Node.js', 'MongoDB', 'Express.js'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Backend Development',
      },
      {
        title: 'Python Developer',
        company: 'Data Co',
        location: 'Remote',
        requiredSkills: ['Python', 'Django'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Backend Development',
      },
    ]);

    // Create resources
    await Resource.create([
      {
        title: 'React Course',
        platform: 'Udemy',
        url: 'https://udemy.com/react',
        relatedSkills: ['React', 'JavaScript'],
        cost: 'Paid',
      },
      {
        title: 'Node.js Tutorial',
        platform: 'FreeCodeCamp',
        url: 'https://freecodecamp.org/nodejs',
        relatedSkills: ['Node.js', 'JavaScript'],
        cost: 'Free',
      },
      {
        title: 'Python Basics',
        platform: 'Coursera',
        url: 'https://coursera.org/python',
        relatedSkills: ['Python'],
        cost: 'Free',
      },
    ]);
  });

  describe('GET /api/recommendations/jobs', () => {
    it('should return job recommendations based on user skills', async () => {
      const response = await request(app)
        .get('/api/recommendations/jobs')
        .set(getAuthHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('jobId');
      expect(response.body.data[0]).toHaveProperty('matchedSkills');
      expect(response.body.data[0]).toHaveProperty('missingSkills');
      expect(response.body.data[0]).toHaveProperty('matchScore');
    });

    it('should only return jobs with at least one matching skill', async () => {
      const response = await request(app)
        .get('/api/recommendations/jobs')
        .set(getAuthHeader(token));

      expect(response.body.data.every(rec => rec.matchedSkills.length > 0)).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/recommendations/jobs');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/recommendations/resources', () => {
    it('should return resource recommendations based on user skills and interests', async () => {
      const response = await request(app)
        .get('/api/recommendations/resources')
        .set(getAuthHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('resourceId');
      expect(response.body.data[0]).toHaveProperty('matchedItems');
      expect(response.body.data[0]).toHaveProperty('matchScore');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/recommendations/resources');

      expect(response.status).toBe(401);
    });
  });
});

