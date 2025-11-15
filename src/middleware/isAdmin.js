const User = require('../models/User');

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking admin status',
      error: error.message,
    });
  }
};

module.exports = isAdmin;

