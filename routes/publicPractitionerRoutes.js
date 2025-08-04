// File: routes/publicPractitionerRoutes.js - OPTIMIZED FOR FREE TIER
const express = require('express');
const router = express.Router();
const Practitioner = require('../models/Practitioner');

// @desc    Get all active practitioners for public directory
// @route   GET /api/public/practitioners  
// @access  Public
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Public practitioners request:', req.query);
    
    const startTime = performance.now();
    
    // CRITICAL: Simple query for free tier - let frontend handle complex filtering
    const query = { status: 'active' };
    
    // Only add search if provided (most expensive operation)
    if (req.query.search && req.query.search.trim()) {
      query.$or = [
        { name: { $regex: req.query.search.trim(), $options: 'i' } },
        { specialty: { $regex: req.query.search.trim(), $options: 'i' } },
        { bio: { $regex: req.query.search.trim(), $options: 'i' } }
      ];
    }
    
    console.log('📊 Database query:', query);
    
    // OPTIMIZED: Get all practitioners at once, let frontend filter
    const practitioners = await Practitioner
      .find(query)
      .select('name title specialty experience bio locations email phone fees insurances paymentOptions sessionTypes isFeatured imageUrl status')
      .sort({ isFeatured: -1, name: 1 })
      .limit(100) // Reasonable limit for free tier
      .lean() // Return plain objects for speed
      .exec();
    
    const duration = performance.now() - startTime;
    console.log(`✅ Found ${practitioners.length} practitioners in ${duration.toFixed(0)}ms`);
    
    // Add cache headers
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'ETag': `"practitioners-${Date.now()}"`,
      'X-Response-Time': `${duration.toFixed(0)}ms`
    });
    
    res.json({
      success: true,
      count: practitioners.length,
      data: practitioners,
      cached: false,
      responseTime: `${duration.toFixed(0)}ms`
    });
    
  } catch (error) {
    console.error('❌ Error fetching practitioners:', error);
    
    // Better error handling for free tier
    let statusCode = 500;
    let message = 'Failed to fetch practitioners';
    
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

// @desc    Get single practitioner details
// @route   GET /api/public/practitioners/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    console.log('👤 Getting practitioner:', req.params.id);
    
    const practitioner = await Practitioner
      .findOne({
        _id: req.params.id,
        status: 'active'
      })
      .lean();
    
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    // Cache individual practitioner for longer
    res.set({
      'Cache-Control': 'public, max-age=600', // 10 minutes
      'ETag': `"practitioner-${practitioner._id}"`
    });
    
    res.json({
      success: true,
      data: practitioner
    });
    
  } catch (error) {
    console.error('❌ Error fetching practitioner:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get featured practitioners
// @route   GET /api/public/practitioners/featured
// @access  Public  
router.get('/featured/list', async (req, res) => {
  try {
    console.log('⭐ Getting featured practitioners');
    
    const practitioners = await Practitioner
      .find({
        status: 'active',
        isFeatured: true
      })
      .select('name title specialty experience bio locations email phone fees sessionTypes imageUrl')
      .limit(5)
      .lean();
    
    // Cache featured practitioners
    res.set({
      'Cache-Control': 'public, max-age=600', // 10 minutes
      'ETag': `"featured-${Date.now()}"`
    });
    
    res.json({
      success: true,
      count: practitioners.length,
      data: practitioners
    });
    
  } catch (error) {
    console.error('❌ Error fetching featured practitioners:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
