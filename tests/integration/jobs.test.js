const request = require('supertest');
const app = require('../../app');
const Job = require('../../src/models/Job');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');

describe('Job Routes', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/jobs', () => {
    beforeEach(async () => {
      await Job.create([
        {
          title: 'Frontend Developer',
          company: 'Tech Corp',
          location: 'Remote',
          requiredSkills: ['React', 'JavaScript'],
          experienceLevel: 'Junior',
          jobType: 'Full-time',
          track: 'Web Development',
        },
        {
          title: 'Backend Developer',
          company: 'Cloud Inc',
          location: 'New York',
          requiredSkills: ['Node.js', 'MongoDB'],
          experienceLevel: 'Mid',
          jobType: 'Full-time',
          track: 'Backend Development',
        },
        {
          title: 'UI Designer',
          company: 'Design Co',
          location: 'Remote',
          requiredSkills: ['Figma', 'Adobe XD'],
          experienceLevel: 'Junior',
          jobType: 'Part-time',
          track: 'Design',
        },
      ]);
    });

    it('should get all jobs', async () => {
      const response = await request(app).get('/api/jobs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.data).toHaveLength(3);
    });

    it('should filter jobs by track', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .query({ track: 'Web Development' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].track).toContain('Web Development');
    });

    it('should filter jobs by location', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .query({ location: 'Remote' });

      expect(response.status).toBe(200);
      expect(response.body.data.every(job => job.location.toLowerCase().includes('remote'))).toBe(true);
    });

    it('should filter jobs by type', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .query({ type: 'Full-time' });

      expect(response.status).toBe(200);
      expect(response.body.data.every(job => job.jobType === 'Full-time')).toBe(true);
    });

    it('should filter jobs by experience level', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .query({ experienceLevel: 'Junior' });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/jobs/:id', () => {
    let job;

    beforeEach(async () => {
      job = await Job.create({
        title: 'Test Job',
        company: 'Test Company',
        location: 'Remote',
        requiredSkills: ['JavaScript'],
        experienceLevel: 'Junior',
        jobType: 'Full-time',
        track: 'Web Development',
      });
    });

    it('should get job by ID', async () => {
      const response = await request(app).get(`/api/jobs/${job._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id.toString()).toBe(job._id.toString());
      expect(response.body.data.title).toBe('Test Job');
    });

    it('should return 404 for non-existent job', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app).get(`/api/jobs/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app).get('/api/jobs/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

