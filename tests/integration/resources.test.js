const request = require('supertest');
const app = require('../../app');
const Resource = require('../../src/models/Resource');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');

describe('Resource Routes', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/resources', () => {
    beforeEach(async () => {
      await Resource.create([
        {
          title: 'React Course',
          platform: 'Udemy',
          url: 'https://udemy.com/react',
          relatedSkills: ['React', 'JavaScript'],
          cost: 'Paid',
        },
        {
          title: 'Python Basics',
          platform: 'Coursera',
          url: 'https://coursera.org/python',
          relatedSkills: ['Python'],
          cost: 'Free',
        },
        {
          title: 'MongoDB Tutorial',
          platform: 'MongoDB',
          url: 'https://mongodb.com/learn',
          relatedSkills: ['MongoDB', 'Database'],
          cost: 'Free',
        },
      ]);
    });

    it('should get all resources', async () => {
      const response = await request(app).get('/api/resources');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.data).toHaveLength(3);
    });

    it('should return resources with correct structure', async () => {
      const response = await request(app).get('/api/resources');

      expect(response.body.data[0]).toHaveProperty('title');
      expect(response.body.data[0]).toHaveProperty('platform');
      expect(response.body.data[0]).toHaveProperty('url');
      expect(response.body.data[0]).toHaveProperty('relatedSkills');
      expect(response.body.data[0]).toHaveProperty('cost');
    });
  });

  describe('GET /api/resources/:id', () => {
    let resource;

    beforeEach(async () => {
      resource = await Resource.create({
        title: 'Test Resource',
        platform: 'Test Platform',
        url: 'https://example.com',
        relatedSkills: ['JavaScript'],
        cost: 'Free',
      });
    });

    it('should get resource by ID', async () => {
      const response = await request(app).get(`/api/resources/${resource._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id.toString()).toBe(resource._id.toString());
      expect(response.body.data.title).toBe('Test Resource');
    });

    it('should return 404 for non-existent resource', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app).get(`/api/resources/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app).get('/api/resources/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

