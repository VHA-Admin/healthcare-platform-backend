// File: middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.authenticateToken = async (req, res, next) => {
  let token;

  // Check if auth header exists and starts with Bearer
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }
  
  // If no token found, return error
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and exclude password
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active (for employee accounts)
    if (user.status && user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Add user to req object with all relevant fields
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      permissions: user.permissions || [],
      status: user.status || 'active'
    };

    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Check for specific permissions (for employee system)
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admins have all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the specific permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// NEW: Check for simplified permissions (for master code operations)
exports.requireNewPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admins have all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the specific permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this operation'
      });
    }

    next();
  };
};

// Middleware for employee-only routes
exports.requireEmployee = (req, res, next) => {
  const employeeRoles = ['admin', 'manager', 'staff', 'support'];
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!employeeRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Employee access required'
    });
  }

  next();
};

// Middleware for admin-only routes
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};