// File: models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  time: {
    type: String,
    required: [true, 'Event time is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: ['workshop', 'seminar', 'support-group', 'training', 'community'],
      message: 'Event type must be one of: workshop, seminar, support-group, training, community'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      message: 'Status must be one of: upcoming, ongoing, completed, cancelled'
    },
    default: 'upcoming'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  registeredAttendees: {
    type: Number,
    default: 0,
    min: [0, 'Registered attendees cannot be negative']
  },
  imageUrl: {
    type: String,
    default: '',
    trim: true
  },
  registrationUrl: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty string or valid URL
        if (v === '') return true;
        
        // Basic URL validation
        try {
          new URL(v);
          return true;
        } catch (error) {
          return false;
        }
      },
      message: 'Please provide a valid registration URL'
    }
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Event organizer is required']
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for better query performance
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ isFeatured: 1 });
eventSchema.index({ title: 'text', description: 'text', location: 'text' });

// Virtual for formatted date
eventSchema.virtual('formattedDate').get(function() {
  if (this.date) {
    return this.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  return '';
});

// Pre-save middleware to handle data processing
eventSchema.pre('save', function(next) {
  // Ensure registeredAttendees is not negative
  if (this.registeredAttendees < 0) {
    this.registeredAttendees = 0;
  }
  
  // Trim string fields
  if (this.title) this.title = this.title.trim();
  if (this.description) this.description = this.description.trim();
  if (this.location) this.location = this.location.trim();
  if (this.time) this.time = this.time.trim();
  if (this.imageUrl) this.imageUrl = this.imageUrl.trim();
  if (this.registrationUrl) this.registrationUrl = this.registrationUrl.trim();
  
  next();
});

// Instance method to check if event is upcoming
eventSchema.methods.isUpcoming = function() {
  return this.status === 'upcoming' && this.date > new Date();
};

// Instance method to check if event is past
eventSchema.methods.isPast = function() {
  return this.status === 'completed' || this.date < new Date();
};

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function() {
  return this.find({
    status: { $in: ['upcoming', 'ongoing'] },
    date: { $gte: new Date() }
  }).sort({ date: 1 });
};

// Static method to find featured events
eventSchema.statics.findFeatured = function() {
  return this.find({ isFeatured: true }).sort({ date: 1 });
};

module.exports = mongoose.model('Event', eventSchema);