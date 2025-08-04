// File: routes/publicEventRoutes.js - OPTIMIZED FOR FREE TIER
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// @desc    Get all upcoming events for public viewing
// @route   GET /api/public/events
// @access  Public
router.get('/', async (req, res) => {
  try {
    console.log('🎉 Public events request:', req.query);
    
    const startTime = performance.now();
    
    // OPTIMIZED: Simple query for free tier
    const query = { 
      status: { $in: ['upcoming', 'ongoing'] }
      // Remove date filter to reduce query complexity on free tier
    };
    
    // Only add search if provided
    if (req.query.search && req.query.search.trim()) {
      query.$or = [
        { title: { $regex: req.query.search.trim(), $options: 'i' } },
        { description: { $regex: req.query.search.trim(), $options: 'i' } },
        { location: { $regex: req.query.search.trim(), $options: 'i' } }
      ];
    }
    
    console.log('📊 Events query:', query);
    
    // Get all events, let frontend filter by type/date
    const events = await Event
      .find(query)
      .select('title description date time location type status isFeatured imageUrl registrationUrl')
      .sort({ isFeatured: -1, date: 1 })
      .limit(50)
      .lean()
      .exec();
    
    const duration = performance.now() - startTime;
    console.log(`✅ Found ${events.length} events in ${duration.toFixed(0)}ms`);
    
    // Add cache headers
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'ETag': `"events-${Date.now()}"`,
      'X-Response-Time': `${duration.toFixed(0)}ms`
    });
    
    res.json({
      success: true,
      count: events.length,
      data: events,
      cached: false,
      responseTime: `${duration.toFixed(0)}ms`
    });
    
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    
    let statusCode = 500;
    let message = 'Failed to fetch events';
    
    if (error.name === 'MongooseError' || error.name === 'MongoError') {
      statusCode = 503;
      message = 'Database temporarily unavailable';
    }
    
    res.status(statusCode).json({
      success: false,
      error: message,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
});

// @desc    Get single event details
// @route   GET /api/public/events/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    console.log('🎉 Getting event:', req.params.id);
    
    const event = await Event
      .findById(req.params.id)
      .lean();
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Cache individual events
    res.set({
      'Cache-Control': 'public, max-age=600', // 10 minutes
      'ETag': `"event-${event._id}"`
    });
    
    res.json({
      success: true,
      data: event
    });
    
  } catch (error) {
    console.error('❌ Error fetching event:', error);
    
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get featured event
// @route   GET /api/public/events/featured
// @access  Public
router.get('/featured/current', async (req, res) => {
  try {
    console.log('⭐ Getting featured event');
    
    const event = await Event
      .findOne({
        status: { $in: ['upcoming', 'ongoing'] },
        isFeatured: true
      })
      .sort('date')
      .lean();
    
    // If no featured event, get the next upcoming event
    if (!event) {
      const nextEvent = await Event
        .findOne({
          status: 'upcoming'
        })
        .sort('date')
        .lean();
      
      if (!nextEvent) {
        return res.status(404).json({
          success: false,
          message: 'No featured or upcoming events found'
        });
      }
      
      // Cache unfeatured fallback
      res.set({
        'Cache-Control': 'public, max-age=300', // 5 minutes
      });
      
      return res.json({
        success: true,
        featured: false,
        data: nextEvent
      });
    }
    
    // Cache featured event
    res.set({
      'Cache-Control': 'public, max-age=600', // 10 minutes
    });
    
    res.json({
      success: true,
      featured: true,
      data: event
    });
    
  } catch (error) {
    console.error('❌ Error fetching featured event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
