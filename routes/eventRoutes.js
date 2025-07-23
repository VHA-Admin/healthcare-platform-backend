// File: routes/eventRoutes.js - Updated with simplified permissions
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { authenticateToken, requireEmployee } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// @desc    Get all events
// @route   GET /api/events
// @access  Private (All employees can access)
router.get('/', requireEmployee, async (req, res) => {
  try {
    // Build query
    let query = {};
    
    // Filter by search term
    if (req.query.search) {
      query = {
        $or: [
          { title: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { location: { $regex: req.query.search, $options: 'i' } }
        ]
      };
    }
    
    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by featured
    if (req.query.isFeatured !== undefined) {
      query.isFeatured = req.query.isFeatured === 'true';
    }
    
    // Filter by date range
    if (req.query.fromDate && req.query.toDate) {
      query.date = {
        $gte: new Date(req.query.fromDate),
        $lte: new Date(req.query.toDate)
      };
    } else if (req.query.fromDate) {
      query.date = { $gte: new Date(req.query.fromDate) };
    } else if (req.query.toDate) {
      query.date = { $lte: new Date(req.query.toDate) };
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Execute query
    const events = await Event.find(query)
      .sort({ date: 1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count
    const totalCount = await Event.countDocuments(query);
    
    console.log(`📊 Events query result: ${events.length} events, ${totalCount} total`);
    
    res.status(200).json({
      success: true,
      count: events.length,
      totalCount: totalCount,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit)
      },
      data: events
    });
  } catch (err) {
    console.error('❌ Error fetching events:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching events'
    });
  }
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Private (All employees can access)
router.get('/:id', requireEmployee, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: event
    });
  } catch (err) {
    console.error('❌ Error fetching event:', err);
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event'
    });
  }
});

// @desc    Create new event
// @route   POST /api/events
// @access  Private (All employees can create)
router.post('/', requireEmployee, async (req, res) => {
  try {
    console.log('📝 Creating new event with data:', req.body);
    console.log('👤 User creating event:', req.user.email, req.user.role);
    
    // Validate required fields
    const { title, description, date, time, location, type } = req.body;
    
    if (!title || !description || !date || !time || !location || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, date, time, location, type'
      });
    }
    
    // Prepare event data
    const eventData = {
      title: title.trim(),
      description: description.trim(),
      date: new Date(date),
      time: time.trim(),
      location: location.trim(),
      type,
      status: req.body.status || 'upcoming',
      isFeatured: Boolean(req.body.isFeatured),
      registeredAttendees: parseInt(req.body.registeredAttendees) || 0,
      imageUrl: req.body.imageUrl || '',
      registrationUrl: req.body.registrationUrl ? req.body.registrationUrl.trim() : '',
      organizer: req.user.id,
      createdBy: req.user.id
    };
    
    console.log('🎯 Processed event data:', eventData);
    
    const event = await Event.create(eventData);
    
    console.log('✅ Event created successfully by', req.user.email, ':', event._id);
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (err) {
    console.error('❌ Error creating event:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}`
      });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Event with this information already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating event'
    });
  }
});

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (All employees can update)
router.put('/:id', requireEmployee, async (req, res) => {
  try {
    console.log(`📝 Updating event ${req.params.id} with data:`, req.body);
    console.log('👤 User updating event:', req.user.email, req.user.role);
    
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Prepare update data - only include fields that are provided
    const updateData = {};
    
    if (req.body.title !== undefined) updateData.title = req.body.title.trim();
    if (req.body.description !== undefined) updateData.description = req.body.description.trim();
    if (req.body.date !== undefined) updateData.date = new Date(req.body.date);
    if (req.body.time !== undefined) updateData.time = req.body.time.trim();
    if (req.body.location !== undefined) updateData.location = req.body.location.trim();
    if (req.body.type !== undefined) updateData.type = req.body.type;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.isFeatured !== undefined) updateData.isFeatured = Boolean(req.body.isFeatured);
    if (req.body.registeredAttendees !== undefined) updateData.registeredAttendees = parseInt(req.body.registeredAttendees) || 0;
    
    // Handle imageUrl - allow empty string to clear the image
    if (req.body.imageUrl !== undefined) {
      updateData.imageUrl = req.body.imageUrl || '';
    }
    
    // Handle registrationUrl - allow empty string to clear the URL
    if (req.body.registrationUrl !== undefined) {
      updateData.registrationUrl = req.body.registrationUrl ? req.body.registrationUrl.trim() : '';
    }
    
    // Track who updated the event
    updateData.updatedBy = req.user.id;
    
    console.log('🎯 Processed update data:', updateData);
    
    // Update event
    event = await Event.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    console.log('✅ Event updated successfully by', req.user.email, ':', event._id);
    
    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (err) {
    console.error('❌ Error updating event:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}`
      });
    }
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Event with this information already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating event'
    });
  }
});

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (All employees can delete)
router.delete('/:id', requireEmployee, async (req, res) => {
  try {
    console.log(`🗑️ Deleting event ${req.params.id}`);
    console.log('👤 User deleting event:', req.user.email, req.user.role);
    
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Delete the event
    await Event.findByIdAndDelete(req.params.id);
    
    console.log('✅ Event deleted successfully by', req.user.email, ':', req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
      data: {}
    });
  } catch (err) {
    console.error('❌ Error deleting event:', err);
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting event'
    });
  }
});

module.exports = router;