// File: routes/practitionerRoutes.js - Updated with simplified permissions
const express = require('express');
const router = express.Router();
const Practitioner = require('../models/Practitioner');
const { authenticateToken, requireEmployee } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// @desc    Get all practitioners
// @route   GET /api/practitioners
// @access  Private (All employees can access)
router.get('/', requireEmployee, async (req, res) => {
  try {
    // Build query
    let query = {};
    
    // Filter by search term
    if (req.query.search) {
      query = {
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { specialty: { $regex: req.query.search, $options: 'i' } },
          { bio: { $regex: req.query.search, $options: 'i' } }
        ]
      };
    }
    
    // Filter by specialty
    if (req.query.specialty) {
      query.specialty = req.query.specialty;
    }
    
    // Filter by location
    if (req.query.location) {
      query.locations = req.query.location;
    }
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by featured
    if (req.query.isFeatured !== undefined) {
      query.isFeatured = req.query.isFeatured === 'true';
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Execute query
    const practitioners = await Practitioner.find(query)
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count
    const totalCount = await Practitioner.countDocuments(query);
    
    console.log(`📊 Practitioners query result: ${practitioners.length} practitioners, ${totalCount} total`);
    
    res.status(200).json({
      success: true,
      count: practitioners.length,
      totalCount: totalCount,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit)
      },
      data: practitioners
    });
  } catch (err) {
    console.error('❌ Error fetching practitioners:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching practitioners'
    });
  }
});

// @desc    Get single practitioner
// @route   GET /api/practitioners/:id
// @access  Private (All employees can access)
router.get('/:id', requireEmployee, async (req, res) => {
  try {
    const practitioner = await Practitioner.findById(req.params.id);
    
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
    console.error('❌ Error fetching practitioner:', err);
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching practitioner'
    });
  }
});

// @desc    Create new practitioner
// @route   POST /api/practitioners
// @access  Private (All employees can create)
router.post('/', requireEmployee, async (req, res) => {
  try {
    console.log('📝 Creating new practitioner with data:', req.body);
    console.log('👤 User creating practitioner:', req.user.email, req.user.role);
    
    // Validate required fields
    const { name, title, specialty, experience, bio, locations, email, phone, sessionTypes } = req.body;
    
    if (!name || !title || !specialty || !experience || !bio || !locations || !email || !phone || !sessionTypes) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, title, specialty, experience, bio, locations, email, phone, sessionTypes'
      });
    }
    
    // Prepare practitioner data
    const practitionerData = {
      name: name.trim(),
      title: title.trim(),
      specialty,
      experience: experience.trim(),
      bio: bio.trim(),
      locations: Array.isArray(locations) ? locations : [],
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: req.body.address ? req.body.address.trim() : '',
      website: req.body.website ? req.body.website.trim() : '',
      fees: {
        initial: parseInt(req.body.fees?.initial) || 150,
        followUp: parseInt(req.body.fees?.followUp) || 120
      },
      insurances: Array.isArray(req.body.insurances) ? req.body.insurances : [],
      paymentOptions: Array.isArray(req.body.paymentOptions) ? req.body.paymentOptions : [],
      sessionTypes: Array.isArray(sessionTypes) ? sessionTypes : [],
      availability: req.body.availability ? req.body.availability.trim() : '',
      education: req.body.education ? req.body.education.trim() : '',
      imageUrl: req.body.imageUrl || '',
      isFeatured: Boolean(req.body.isFeatured),
      status: req.body.status || 'active',
      createdBy: req.user.id
    };
    
    console.log('🎯 Processed practitioner data:', practitionerData);
    
    const practitioner = await Practitioner.create(practitionerData);
    
    console.log('✅ Practitioner created successfully by', req.user.email, ':', practitioner._id);
    
    res.status(201).json({
      success: true,
      message: 'Practitioner created successfully',
      data: practitioner
    });
  } catch (err) {
    console.error('❌ Error creating practitioner:', err);
    
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
        message: 'Practitioner with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating practitioner'
    });
  }
});

// @desc    Update practitioner
// @route   PUT /api/practitioners/:id
// @access  Private (All employees can update)
router.put('/:id', requireEmployee, async (req, res) => {
  try {
    console.log(`📝 Updating practitioner ${req.params.id} with data:`, req.body);
    console.log('👤 User updating practitioner:', req.user.email, req.user.role);
    
    let practitioner = await Practitioner.findById(req.params.id);
    
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    // Prepare update data - only include fields that are provided
    const updateData = {};
    
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.title !== undefined) updateData.title = req.body.title.trim();
    if (req.body.specialty !== undefined) updateData.specialty = req.body.specialty;
    if (req.body.experience !== undefined) updateData.experience = req.body.experience.trim();
    if (req.body.bio !== undefined) updateData.bio = req.body.bio.trim();
    if (req.body.locations !== undefined) updateData.locations = Array.isArray(req.body.locations) ? req.body.locations : [];
    if (req.body.email !== undefined) updateData.email = req.body.email.trim().toLowerCase();
    if (req.body.phone !== undefined) updateData.phone = req.body.phone.trim();
    if (req.body.address !== undefined) updateData.address = req.body.address ? req.body.address.trim() : '';
    if (req.body.website !== undefined) updateData.website = req.body.website ? req.body.website.trim() : '';
    if (req.body.fees !== undefined) {
      updateData.fees = {
        initial: parseInt(req.body.fees?.initial) || 150,
        followUp: parseInt(req.body.fees?.followUp) || 120
      };
    }
    if (req.body.insurances !== undefined) updateData.insurances = Array.isArray(req.body.insurances) ? req.body.insurances : [];
    if (req.body.paymentOptions !== undefined) updateData.paymentOptions = Array.isArray(req.body.paymentOptions) ? req.body.paymentOptions : [];
    if (req.body.sessionTypes !== undefined) updateData.sessionTypes = Array.isArray(req.body.sessionTypes) ? req.body.sessionTypes : [];
    if (req.body.availability !== undefined) updateData.availability = req.body.availability ? req.body.availability.trim() : '';
    if (req.body.education !== undefined) updateData.education = req.body.education ? req.body.education.trim() : '';
    if (req.body.imageUrl !== undefined) updateData.imageUrl = req.body.imageUrl || '';
    if (req.body.isFeatured !== undefined) updateData.isFeatured = Boolean(req.body.isFeatured);
    if (req.body.status !== undefined) updateData.status = req.body.status;
    
    // Track who updated the practitioner
    updateData.updatedBy = req.user.id;
    
    console.log('🎯 Processed update data:', updateData);
    
    // Update practitioner
    practitioner = await Practitioner.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    console.log('✅ Practitioner updated successfully by', req.user.email, ':', practitioner._id);
    
    res.status(200).json({
      success: true,
      message: 'Practitioner updated successfully',
      data: practitioner
    });
  } catch (err) {
    console.error('❌ Error updating practitioner:', err);
    
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
        message: 'Practitioner not found'
      });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Practitioner with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating practitioner'
    });
  }
});

// @desc    Delete practitioner
// @route   DELETE /api/practitioners/:id
// @access  Private (All employees can delete)
router.delete('/:id', requireEmployee, async (req, res) => {
  try {
    console.log(`🗑️ Deleting practitioner ${req.params.id}`);
    console.log('👤 User deleting practitioner:', req.user.email, req.user.role);
    
    const practitioner = await Practitioner.findById(req.params.id);
    
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    // Delete the practitioner
    await Practitioner.findByIdAndDelete(req.params.id);
    
    console.log('✅ Practitioner deleted successfully by', req.user.email, ':', req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Practitioner deleted successfully',
      data: {}
    });
  } catch (err) {
    console.error('❌ Error deleting practitioner:', err);
    
    // Handle invalid ObjectId
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting practitioner'
    });
  }
});

module.exports = router;