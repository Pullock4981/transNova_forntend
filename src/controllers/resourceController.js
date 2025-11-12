const Resource = require('../models/Resource');

/**
 * Get all learning resources
 * GET /resources
 */
const getResources = async (req, res, next) => {
  try {
    const resources = await Resource.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: resources.length,
      data: resources,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single resource by ID
 * GET /resources/:id
 */
const getResourceById = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    res.status(200).json({
      success: true,
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResources,
  getResourceById,
};

