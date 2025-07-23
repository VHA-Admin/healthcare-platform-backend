// File: utils/imageUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
    // Create a more secure unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

// Enhanced file filter for images
const fileFilter = (req, file, cb) => {
  // Define allowed image types
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  // Check file type
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`), false);
  }
};

// Initialize multer upload with enhanced configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_UPLOAD) || 5 * 1024 * 1024, // Default 5MB
    files: 1 // Limit to 1 file per request
  },
  fileFilter: fileFilter
});

// Custom error handler for multer errors
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

// Export middleware for different file fields
module.exports = {
  // For single image upload
  uploadSingleImage: (fieldName) => [upload.single(fieldName), handleMulterError],
  
  // For multiple images upload
  uploadMultipleImages: (fieldName, maxCount = 5) => [upload.array(fieldName, maxCount), handleMulterError],
  
  // Utility function to delete a file
  deleteFile: (filename) => {
    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  },
  
  // Utility function to check if file exists
  fileExists: (filename) => {
    const filePath = path.join(process.cwd(), 'uploads', filename);
    return fs.existsSync(filePath);
  }
};