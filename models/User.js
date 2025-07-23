// File: models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  role: {
    type: String,
    enum: ['user', 'practitioner', 'admin', 'manager', 'staff', 'support'],
    default: 'user'
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  // Employee-specific fields
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [50, 'Department cannot exceed 50 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Existing fields
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ department: 1 });
UserSchema.index({ name: 'text', email: 'text', department: 'text' });

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  
  // Update timestamp
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: this.role,
      email: this.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to check if user has specific permission
UserSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.role === 'admin';
};

// Method to get role display name
UserSchema.methods.getRoleDisplay = function() {
  return this.role.charAt(0).toUpperCase() + this.role.slice(1);
};

// Method to get status display name
UserSchema.methods.getStatusDisplay = function() {
  return this.status.charAt(0).toUpperCase() + this.status.slice(1);
};

// Static method to find active users
UserSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method to find by role
UserSchema.statics.findByRole = function(role) {
  return this.find({ role: role });
};

// Static method to search users
UserSchema.statics.searchUsers = function(searchTerm) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { department: { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

// Virtual for checking if user is admin
UserSchema.virtual('isAdmin').get(function() {
  return this.role === 'admin';
});

// Virtual for checking if user is employee
UserSchema.virtual('isEmployee').get(function() {
  return ['admin', 'manager', 'staff', 'support'].includes(this.role);
});

module.exports = mongoose.model('User', UserSchema);