// File: models/Practitioner.js
const mongoose = require('mongoose');

const PractitionerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  title: {
    type: String,
    required: [true, 'Please add a professional title'],
    trim: true
  },
  specialty: {
    type: String,
    required: [true, 'Please add a specialty'],
    trim: true
  },
  experience: {
    type: String,
    required: [true, 'Please add years of experience'],
    trim: true
  },
  bio: {
    type: String,
    required: [true, 'Please add a bio'],
    maxlength: [1000, 'Bio cannot be more than 1000 characters']
  },
  locations: {
    type: [String],
    required: [true, 'Please add at least one location']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number']
  },
  address: {
    type: String,
    required: false
  },
  website: {
    type: String,
    required: false,
    match: [
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
      'Please use a valid URL with HTTP or HTTPS'
    ]
  },
  fees: {
    initial: {
      type: Number,
      required: [true, 'Please add an initial session fee']
    },
    followUp: {
      type: Number,
      required: [true, 'Please add a follow-up session fee']
    }
  },
  insurances: {
    type: [String],
    required: false
  },
  paymentOptions: {
    type: [String],
    required: false
  },
  sessionTypes: {
    type: [String],
    required: [true, 'Please add at least one session type']
  },
  availability: {
    type: String,
    required: false
  },
  education: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create slug from name
PractitionerSchema.pre('save', function(next) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
  next();
});

module.exports = mongoose.model('Practitioner', PractitionerSchema);