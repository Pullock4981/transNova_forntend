const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const isAdmin = require('../middleware/isAdmin');
const {
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
  getAllResources,
  createResource,
  updateResource,
  deleteResource,
  getAllSkills,
  addDomain,
  removeDomain,
  getAllUsers,
  getUserById,
  sendSkillRecommendationsToAllUsers,
  scrapeBdjobsJobs,
} = require('../controllers/adminController');

// All admin routes require authentication and admin role
router.use(authenticateJWT);
router.use(isAdmin);

// Jobs routes
router.get('/jobs', getAllJobs);
router.post('/jobs', createJob);
router.put('/jobs/:id', updateJob);
router.delete('/jobs/:id', deleteJob);

// Resources routes
router.get('/resources', getAllResources);
router.post('/resources', createResource);
router.put('/resources/:id', updateResource);
router.delete('/resources/:id', deleteResource);

// Skills/Domains routes
router.get('/skills', getAllSkills);
router.post('/domains', addDomain);
router.delete('/domains', removeDomain);

// Users routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);

// Skill Recommendations route
router.post('/send-skill-recommendations', sendSkillRecommendationsToAllUsers);

// Bdjobs Scraping route
router.post('/scrape-bdjobs', scrapeBdjobsJobs);

module.exports = router;

