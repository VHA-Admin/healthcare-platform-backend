// routes/employeeRoutes.js - Simplified Permissions Version
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireEmployee, requireAdmin, requirePermission, requireNewPermission } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Define the new permission constants
const NEW_PERMISSIONS = {
  CHANGE_USER_PASSWORDS: 'change_user_passwords',
  DELETE_USERS: 'delete_users'
};

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/employees/stats - Get employee statistics (ALL EMPLOYEES CAN ACCESS)
router.get('/stats', requireEmployee, async (req, res) => {
  try {
    const employeeFilter = { role: { $in: ['admin', 'manager', 'staff', 'support'] } };
    
    const [
      totalCount,
      activeCount,
      inactiveCount,
      adminCount,
      roleStats,
      departmentStats
    ] = await Promise.all([
      User.countDocuments(employeeFilter),
      User.countDocuments({ ...employeeFilter, status: 'active' }),
      User.countDocuments({ ...employeeFilter, status: 'inactive' }),
      User.countDocuments({ role: 'admin' }),
      User.aggregate([
        { $match: employeeFilter },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: employeeFilter },
        { $group: { _id: '$department', count: { $sum: 1 } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        total: totalCount,
        active: activeCount,
        inactive: inactiveCount,
        admin: adminCount,
        roleBreakdown: roleStats,
        departmentBreakdown: departmentStats
      }
    });
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee statistics',
      error: error.message
    });
  }
});

// PUT /api/employees/bulk - Bulk update employees (requires admin or manage_users permission)
router.put('/bulk', requirePermission('manage_users'), async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Employee IDs are required'
      });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    
    const result = await User.updateMany(
      { 
        _id: { $in: ids },
        role: { $in: ['admin', 'manager', 'staff', 'support'] }
      },
      updateData
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} employees updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk updating employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employees',
      error: error.message
    });
  }
});

// GET /api/employees - Get all employees with filtering (ALL EMPLOYEES CAN ACCESS)
router.get('/', requireEmployee, async (req, res) => {
  try {
    const { search, role, status, department, page = 1, limit = 50 } = req.query;
    
    // Build filter object - only get employee roles
    const filter = {
      role: { $in: ['admin', 'manager', 'staff', 'support'] }
    };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role && ['admin', 'manager', 'staff', 'support'].includes(role)) {
      filter.role = role;
    }
    if (status) filter.status = status;
    if (department) filter.department = department;
    
    // Execute query with pagination
    const employees = await User.find(filter)
      .select('-password') // Exclude password from results
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalCount = await User.countDocuments(filter);
    
    res.json({
      success: true,
      data: employees,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// GET /api/employees/:id - Get single employee (ALL EMPLOYEES CAN ACCESS)
router.get('/:id', requireEmployee, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).select('-password');
    
    if (!employee || !['admin', 'manager', 'staff', 'support'].includes(employee.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
      error: error.message
    });
  }
});

// POST /api/employees - Create new employee (requires admin or manage_users permission)
router.post('/', requirePermission('manage_users'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      status,
      permissions,
      password,
      sendWelcomeEmail
    } = req.body;
    
    // Validation
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, role, and department are required'
      });
    }
    
    // Validate role
    if (!['admin', 'manager', 'staff', 'support'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, manager, staff, or support'
      });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Create new employee
    const employee = new User({
      name,
      email,
      phone,
      role,
      department,
      status: status || 'active',
      permissions: permissions || [],
      password, // Will be hashed by the pre-save middleware
      isEmailVerified: false,
      createdBy: req.user.id
    });
    
    await employee.save();
    
    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;
    
    // TODO: Send welcome email if sendWelcomeEmail is true
    
    res.status(201).json({
      success: true,
      data: employeeResponse,
      message: 'Employee created successfully'
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message
    });
  }
});

// PUT /api/employees/:id - Update employee (requires admin or manage_users permission)
router.put('/:id', requirePermission('manage_users'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      status,
      permissions
    } = req.body;
    
    // Find employee
    const employee = await User.findById(req.params.id);
    if (!employee || !['admin', 'manager', 'staff', 'support'].includes(employee.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Check if email is being changed and if it already exists
    if (email && email !== employee.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }
    
    // Validate role if provided
    if (role && !['admin', 'manager', 'staff', 'support'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, manager, staff, or support'
      });
    }
    
    // Update fields
    if (name) employee.name = name;
    if (email) employee.email = email;
    if (phone !== undefined) employee.phone = phone;
    if (role) employee.role = role;
    if (department) employee.department = department;
    if (status) employee.status = status;
    if (permissions) employee.permissions = permissions;
    
    await employee.save();
    
    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;
    
    res.json({
      success: true,
      data: employeeResponse,
      message: 'Employee updated successfully'
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message
    });
  }
});

// DELETE /api/employees/:id - Delete employee (requires permission + master code)
router.delete('/:id', requireNewPermission(NEW_PERMISSIONS.DELETE_USERS), async (req, res) => {
  try {
    const { masterCode } = req.body;
    const employeeId = req.params.id;
    
    // Verify master code matches your env variable
    if (masterCode !== process.env.MASTER_SECURITY_CODE) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid master security code. Access denied.' 
      });
    }
    
    const employee = await User.findById(employeeId);
    
    if (!employee || !['admin', 'manager', 'staff', 'support'].includes(employee.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Prevent deleting the last admin
    if (employee.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin user'
        });
      }
    }
    
    // Prevent users from deleting themselves
    if (employee._id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    await User.findByIdAndDelete(employeeId);
    
    // Log the action
    console.log(`Employee ${employee.email} deleted by ${req.user.email} using master code`);
    
    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee',
      error: error.message
    });
  }
});

// POST /api/employees/:id/reset-password - Reset employee password (requires permission + master code)
router.post('/:id/reset-password', requireNewPermission(NEW_PERMISSIONS.CHANGE_USER_PASSWORDS), async (req, res) => {
  try {
    const { masterCode } = req.body;
    const employeeId = req.params.id;
    
    // Verify master code matches your env variable
    if (masterCode !== process.env.MASTER_SECURITY_CODE) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid master security code. Access denied.' 
      });
    }
    
    const employee = await User.findById(employeeId);
    
    if (!employee || !['admin', 'manager', 'staff', 'support'].includes(employee.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    
    // Update employee password (will be hashed by pre-save middleware)
    employee.password = tempPassword;
    employee.mustChangePassword = true; // Flag to force password change on next login
    
    await employee.save();
    
    // Log the action
    console.log(`Password reset for ${employee.email} by ${req.user.email} using master code`);
    
    res.json({
      success: true,
      temporaryPassword: tempPassword, // In production, don't return this - send via email
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

module.exports = router;