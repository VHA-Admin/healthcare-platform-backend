// File: routes/publicPractitionerRoutes.js
const express = require('express');
const router = express.Router();
const Practitioner = require('../models/Practitioner');

// @desc    Get all active practitioners for public directory
// @route   GET /api/public/practitioners
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Build query - only show active practitioners
    let query = { status: 'active' };
    
    // Filter by search term
    if (req.query.search) {
      query = {
        ...query,
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { specialty: { $regex: req.query.search, $options: 'i' } },
          { bio: { $regex: req.query.search, $options: 'i' } }
        ]
      };
    }
    
    // Filter by specialty
    if (req.query.specialty) {
      if (Array.isArray(req.query.specialty)) {
        query.specialty = { $in: req.query.specialty };
      } else {
        query.specialty = req.query.specialty;
      }
    }
    
    // Filter by location
    if (req.query.location) {
      if (Array.isArray(req.query.location)) {
        query.locations = { $in: req.query.location };
      } else {
        query.locations = req.query.location;
      }
    }
    
    // Filter by insurances
    if (req.query.insurance) {
      if (Array.isArray(req.query.insurance)) {
        query.insurances = { $in: req.query.insurance };
      } else {
        query.insurances = req.query.insurance;
      }
    }
    
    // Filter by payment options
    if (req.query.paymentOption) {
      if (Array.isArray(req.query.paymentOption)) {
        query.paymentOptions = { $in: req.query.paymentOption };
      } else {
        query.paymentOptions = req.query.paymentOption;
      }
    }
    
    // Filter by session types
    if (req.query.sessionType) {
      if (Array.isArray(req.query.sessionType)) {
        query.sessionTypes = { $in: req.query.sessionType };
      } else {
        query.sessionTypes = req.query.sessionType;
      }
    }
    
    // Filter by max fee
    if (req.query.maxFee) {
      query['fees.followUp'] = { $lte: parseInt(req.query.maxFee) };
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const startIndex = (page - 1) * limit;
    
    // Execute query
    const practitioners = await Practitioner.find(query)
      .sort({ isFeatured: -1, rating: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count
    const total = await Practitioner.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: practitioners.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: practitioners
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single practitioner details
// @route   GET /api/public/practitioners/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const practitioner = await Practitioner.findOne({
      _id: req.params.id,
      status: 'active'
    });
    
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: practitioner
    });
  } catch (err) {
    console.error(err);
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
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
    const practitioners = await Practitioner.find({
      status: 'active',
      isFeatured: true
    }).limit(5);
    
    res.status(200).json({
      success: true,
      count: practitioners.length,
      data: practitioners
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
