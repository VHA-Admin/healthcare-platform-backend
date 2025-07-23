// File: routes/publicEventRoutes.js
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// @desc    Get all upcoming events for public viewing
// @route   GET /api/public/events
// @access  Public
router.get('/', async (req, res) => {
  try {
    // By default, show upcoming and ongoing events
    let query = { 
      status: { $in: ['upcoming', 'ongoing'] },
      date: { $gte: new Date() }
    };
    
    // Filter by search term
    if (req.query.search) {
      query = {
        ...query,
        $or: [
          { title: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { location: { $regex: req.query.search, $options: 'i' } }
        ]
      };
    }
    
    // Filter by type
    if (req.query.type && req.query.type !== 'all') {
      query.type = req.query.type;
    }
    
    // Filter by date range (for specific time periods)
    if (req.query.dateRange) {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      
      switch (req.query.dateRange) {
        case 'next7days':
          query.date = { $gte: today, $lte: nextWeek };
          break;
        case 'thisMonth':
          const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          query.date = { $gte: today, $lte: thisMonthEnd };
          break;
        case 'nextMonth':
          const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
          query.date = { $gte: nextMonthStart, $lte: nextMonthEnd };
          break;
        default:
          // 'all' - no additional date filtering needed beyond the default
          break;
      }
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 6;
    const startIndex = (page - 1) * limit;
    
    // Execute query
    const events = await Event.find(query)
      .sort({ isFeatured: -1, date: 1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count
    const total = await Event.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: events.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: events
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single event details
// @route   GET /api/public/events/:id
// @access  Public
router.get('/:id', async (req, res) => {
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
    console.error(err);
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
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
    const event = await Event.findOne({
      status: { $in: ['upcoming', 'ongoing'] },
      date: { $gte: new Date() },
      isFeatured: true
    }).sort('date');
    
    // If no featured event, get the next upcoming event
    if (!event) {
      const nextEvent = await Event.findOne({
        status: 'upcoming',
        date: { $gte: new Date() }
      }).sort('date');
      
      if (!nextEvent) {
        return res.status(404).json({
          success: false,
          message: 'No featured or upcoming events found'
        });
      }
      
      return res.status(200).json({
        success: true,
        featured: false,
        data: nextEvent
      });
    }
    
    res.status(200).json({
      success: true,
      featured: true,
      data: event
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
