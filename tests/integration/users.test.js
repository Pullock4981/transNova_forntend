const request = require('supertest');
const app = require('../../app');
const User = require('../../src/models/User');
const Job = require('../../src/models/Job');
const Resource = require('../../src/models/Resource');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');
const { createTestUser, getAuthHeader } = require('../helpers/authHelper');

describe('User Routes', () => {
  let user, token;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    const testUser = await createTestUser();
    user = testUser.user;
    token = testUser.token;
  });

  describe('GET /api/users/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set(getAuthHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id.toString()).toBe(user._id.toString());
      expect(response.body.data.email).toBe(user.email);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set(getAuthHeader(token))
        .send({
          fullName: 'Updated Name',
          educationLevel: 'Bachelor\'s',
          experienceLevel: 'Junior',
          preferredTrack: 'Web Development',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fullName).toBe('Updated Name');
      expect(response.body.data.educationLevel).toBe('Bachelor\'s');
      expect(response.body.data.experienceLevel).toBe('Junior');
    });
  });

  describe('PATCH /api/users/me/skills', () => {
    it('should update user skills', async () => {
      const skills = ['JavaScript', 'React', 'Node.js'];

      const response = await request(app)
        .patch('/api/users/me/skills')
        .set(getAuthHeader(token))
        .send({ skills });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.skills).toEqual(skills);
    });

    it('should return 400 if skills is not an array', async () => {
      const response = await request(app)
        .patch('/api/users/me/skills')
        .set(getAuthHeader(token))
        .send({ skills: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/users/me/interests', () => {
    it('should update career interests', async () => {
      const careerInterests = ['Full Stack Development', 'DevOps'];

      const response = await request(app)
        .patch('/api/users/me/interests')
        .set(getAuthHeader(token))
        .send({ careerInterests });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.careerInterests).toEqual(careerInterests);
    });
  });

  describe('POST /api/users/me/cv', () => {
    it('should store CV text', async () => {
      const cvText = 'Experienced developer with 5 years of experience...';

      const response = await request(app)
        .post('/api/users/me/cv')
        .set(getAuthHeader(token))
        .send({ cvText });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cvText).toBe(cvText);
    });
  });

  describe('POST /api/users/me/save-job/:jobId', () => {
    it('should save a job to user profile', async () => {
      const job = await Job.create({
        title: 'Test Job',
        company: 'Test Company',
        location: 'Remote',
        requiredSkills: ['JavaScript'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Web Development',
      });

      const response = await request(app)
        .post(`/api/users/me/save-job/${job._id}`)
        .set(getAuthHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 400 with invalid job ID', async () => {
      const response = await request(app)
        .post('/api/users/me/save-job/invalid-id')
        .set(getAuthHeader(token));

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/users/me/save-resource/:resourceId', () => {
    it('should save a resource to user profile', async () => {
      const resource = await Resource.create({
        title: 'Test Resource',
        platform: 'Test Platform',
        url: 'https://example.com',
        relatedSkills: ['JavaScript'],
        cost: 'Free',
      });

      const response = await request(app)
        .post(`/api/users/me/save-resource/${resource._id}`)
        .set(getAuthHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});

