// models/Employee.js
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['admin', 'manager', 'staff', 'support'],
      message: 'Role must be one of: admin, manager, staff, support'
    },
    default: 'staff'
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    maxlength: [50, 'Department cannot exceed 50 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'suspended'],
      message: 'Status must be one of: active, inactive, suspended'
    },
    default: 'active'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_events', 
      'manage_practitioners',
      'view_analytics',
      'system_settings'
    ]
  }],
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
employeeSchema.index({ email: 1 });
employeeSchema.index({ role: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ name: 'text', email: 'text', department: 'text' });

// Virtual for full name display
employeeSchema.virtual('displayName').get(function() {
  return this.name;
});

// Virtual for checking if user is admin
employeeSchema.virtual('isAdmin').get(function() {
  return this.role === 'admin';
});

// Pre-save middleware to update timestamps
employeeSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Method to check if employee has specific permission
employeeSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.role === 'admin';
};

// Method to get role display name
employeeSchema.methods.getRoleDisplay = function() {
  return this.role.charAt(0).toUpperCase() + this.role.slice(1);
};

// Method to get status display name
employeeSchema.methods.getStatusDisplay = function() {
  return this.status.charAt(0).toUpperCase() + this.status.slice(1);
};

// Static method to find active employees
employeeSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method to find by role
employeeSchema.statics.findByRole = function(role) {
  return this.find({ role: role });
};

// Static method to search employees
employeeSchema.statics.searchEmployees = function(searchTerm) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { department: { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

module.exports = mongoose.model('Employee', employeeSchema);