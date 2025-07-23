// File: routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    // Create a secure unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`), false);
  }
};

// Initialize multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: fileFilter
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: 'File too large. Maximum size allowed is 5MB.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Only one file is allowed.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name for file upload.'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// @desc    Upload event image
// @route   POST /api/upload/event-image
// @access  Private (Admin only)
router.post('/event-image', authorize('admin'), upload.single('image'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    // Return the file path relative to the public directory
    const filePath = `/uploads/${req.file.filename}`;
    
    console.log('Event image uploaded:', {
      filename: req.file.filename,
      path: filePath,
      size: req.file.size
    });
    
    res.status(200).json({
      success: true,
      message: 'Event image uploaded successfully',
      data: {
        filename: req.file.filename,
        filePath: filePath,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Event image upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error uploading event image'
    });
  }
});

// @desc    Upload practitioner image
// @route   POST /api/upload/practitioner-image
// @access  Private (Admin only)
router.post('/practitioner-image', authorize('admin'), upload.single('image'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    // Return the file path relative to the public directory
    const filePath = `/uploads/${req.file.filename}`;
    
    console.log('Practitioner image uploaded:', {
      filename: req.file.filename,
      path: filePath,
      size: req.file.size
    });
    
    res.status(200).json({
      success: true,
      message: 'Practitioner image uploaded successfully',
      data: {
        filename: req.file.filename,
        filePath: filePath,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Practitioner image upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error uploading practitioner image'
    });
  }
});

// @desc    Delete uploaded image
// @route   DELETE /api/upload/:filename
// @access  Private (Admin only)
router.delete('/:filename', authorize('admin'), async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    console.log('Image deleted:', filename);
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting image'
    });
  }
});

// @desc    Get image info
// @route   GET /api/upload/:filename
// @access  Private (Admin only)
router.get('/:filename', authorize('admin'), async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    res.status(200).json({
      success: true,
      data: {
        filename: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        url: `/uploads/${filename}`
      }
    });
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting file information'
    });
  }
});

module.exports = router;