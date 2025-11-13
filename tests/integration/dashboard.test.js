const request = require('supertest');
const app = require('../../app');
const User = require('../../src/models/User');
const Job = require('../../src/models/Job');
const Resource = require('../../src/models/Resource');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');
const { createTestUser, getAuthHeader } = require('../helpers/authHelper');

describe('Dashboard Route', () => {
  let user, token;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test user
    const testUser = await createTestUser({
      skills: ['JavaScript', 'React'],
      careerInterests: ['Web Development'],
    });
    user = testUser.user;
    token = testUser.token;

    // Create jobs
    const job1 = await Job.create({
      title: 'Frontend Developer',
      company: 'Tech Corp',
      location: 'Remote',
      requiredSkills: ['JavaScript', 'React'],
      experienceLevel: 'Junior',
      jobType: 'Full-time',
      track: 'Web Development',
    });

    // Create resources
    const resource1 = await Resource.create({
      title: 'React Course',
      platform: 'Udemy',
      url: 'https://udemy.com/react',
      relatedSkills: ['React', 'JavaScript'],
      cost: 'Paid',
    });

    // Save jobs and resources to user
    await User.findByIdAndUpdate(user._id, {
      $push: { savedJobs: job1._id, savedResources: resource1._id },
    });
  });

  describe('GET /api/dashboard', () => {
    it('should return dashboard data', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(getAuthHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('recommendedJobs');
      expect(response.body.data).toHaveProperty('recommendedResources');
      expect(response.body.data).toHaveProperty('savedJobs');
      expect(response.body.data).toHaveProperty('savedResources');
    });

    it('should include user profile in dashboard', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(getAuthHeader(token));

      expect(response.body.data.user).toHaveProperty('fullName');
      expect(response.body.data.user).toHaveProperty('email');
      expect(response.body.data.user).toHaveProperty('skills');
    });

    it('should include recommended jobs', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(getAuthHeader(token));

      expect(response.body.data.recommendedJobs).toHaveProperty('count');
      expect(response.body.data.recommendedJobs).toHaveProperty('jobs');
      expect(Array.isArray(response.body.data.recommendedJobs.jobs)).toBe(true);
    });

    it('should include saved jobs and resources', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set(getAuthHeader(token));

      expect(Array.isArray(response.body.data.savedJobs)).toBe(true);
      expect(Array.isArray(response.body.data.savedResources)).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/dashboard');

      expect(response.status).toBe(401);
    });
  });
});

