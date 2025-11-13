const {
  getJobRecommendations,
  getResourceRecommendations,
} = require('../../src/services/recommendationService');
const User = require('../../src/models/User');
const Job = require('../../src/models/Job');
const Resource = require('../../src/models/Resource');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');

describe('Recommendation Service', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('getJobRecommendations', () => {
    it('should return empty array if user has no skills', async () => {
      const user = await User.create({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        skills: [],
      });

      const recommendations = await getJobRecommendations(user._id);
      expect(recommendations).toEqual([]);
    });

    it('should return jobs with matching skills', async () => {
      const user = await User.create({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        skills: ['JavaScript', 'React'],
      });

      await Job.create([
        {
          title: 'Frontend Developer',
          company: 'Tech Corp',
          location: 'Remote',
          requiredSkills: ['JavaScript', 'React', 'HTML'],
          experienceLevel: 'Junior',
          jobType: 'Full-time',
          track: 'Web Development',
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

      const recommendations = await getJobRecommendations(user._id);

      expect(recommendations.length).toBe(1);
      expect(recommendations[0].matchedSkills).toContain('JavaScript');
      expect(recommendations[0].matchedSkills).toContain('React');
      expect(recommendations[0]).toHaveProperty('missingSkills');
      expect(recommendations[0]).toHaveProperty('matchScore');
    });

    it('should sort recommendations by match score', async () => {
      const user = await User.create({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        skills: ['JavaScript', 'React'],
      });

      await Job.create([
        {
          title: 'Job 1',
          company: 'Company 1',
          location: 'Remote',
          requiredSkills: ['JavaScript', 'React', 'HTML', 'CSS'],
          experienceLevel: 'Junior',
          jobType: 'Full-time',
          track: 'Web Development',
        },
        {
          title: 'Job 2',
          company: 'Company 2',
          location: 'Remote',
          requiredSkills: ['JavaScript'],
          experienceLevel: 'Junior',
          jobType: 'Full-time',
          track: 'Web Development',
        },
      ]);

      const recommendations = await getJobRecommendations(user._id);

      expect(recommendations.length).toBe(2);
      // Job 2 should have higher match score (1/1 = 1.0) than Job 1 (2/4 = 0.5)
      expect(recommendations[0].matchScore).toBeGreaterThanOrEqual(
        recommendations[1].matchScore
      );
    });
  });

  describe('getResourceRecommendations', () => {
    it('should return empty array if user has no skills or interests', async () => {
      const user = await User.create({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        skills: [],
        careerInterests: [],
      });

      const recommendations = await getResourceRecommendations(user._id);
      expect(recommendations).toEqual([]);
    });

    it('should match resources based on user skills and interests', async () => {
      const user = await User.create({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        skills: ['JavaScript'],
        careerInterests: ['Web Development'],
      });

      await Resource.create([
        {
          title: 'JavaScript Course',
          platform: 'Udemy',
          url: 'https://udemy.com/js',
          relatedSkills: ['JavaScript', 'Programming'],
          cost: 'Paid',
        },
        {
          title: 'Python Basics',
          platform: 'Coursera',
          url: 'https://coursera.org/python',
          relatedSkills: ['Python'],
          cost: 'Free',
        },
      ]);

      const recommendations = await getResourceRecommendations(user._id);

      expect(recommendations.length).toBe(1);
      expect(recommendations[0].matchedItems).toContain('JavaScript');
      expect(recommendations[0]).toHaveProperty('matchScore');
    });
  });
});

