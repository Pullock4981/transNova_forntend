const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId
 * @param {string} paramName - Name of the parameter to validate (default: 'id')
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
    }

    next();
  };
};

module.exports = validateObjectId;

