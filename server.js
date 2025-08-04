// File: server.js - OPTIMIZED FOR RENDER FREE TIER
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const compression = require('compression'); // ADD THIS
const authRoutes = require('./routes/authRoutes');
const practitionerRoutes = require('./routes/practitionerRoutes');
const eventRoutes = require('./routes/eventRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const { authenticateToken } = require('./middleware/authMiddleware');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// CRITICAL: Add compression for smaller responses
app.use(compression());

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// OPTIMIZED MongoDB connection for free tier
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 5,        // Lower connection pool for free tier
  serverSelectionTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000, // 45 seconds
  bufferMaxEntries: 0,    // Disable buffering
  retryWrites: true,
  retryReads: true
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  console.log('📊 Database ready for queries');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// CRITICAL: Keep database awake for free tier
setInterval(async () => {
  try {
    await mongoose.connection.db.admin().ping();
    console.log('📡 Database ping successful -', new Date().toLocaleTimeString());
  } catch (error) {
    console.log('❌ Database ping failed:', error.message);
  }
}, 10 * 60 * 1000); // Every 10 minutes

// CRITICAL: Add health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Simple database ping
    await mongoose.connection.db.admin().ping();
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes with caching headers
app.use('/api/auth', authRoutes);

// Add cache headers middleware for public routes
const addCacheHeaders = (req, res, next) => {
  // Cache public data for 5 minutes
  res.set({
    'Cache-Control': 'public, max-age=300',
    'ETag': `"${Date.now()}"`,
    'Vary': 'Accept-Encoding'
  });
  next();
};

// Apply caching to public routes
app.use('/api/public/practitioners', addCacheHeaders, require('./routes/publicPractitionerRoutes'));
app.use('/api/public/events', addCacheHeaders, require('./routes/publicEventRoutes'));

// Admin routes (no caching)
app.use('/api/practitioners', practitionerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/upload', uploadRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend API is running!',
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// ENHANCED: Better error handling for free tier
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  
  // Handle specific database errors
  if (err.name === 'MongooseError' || err.name === 'MongoError') {
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable. Please try again.',
      type: 'database_error'
    });
  }
  
  // Handle timeout errors
  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      success: false,
      message: 'Request timeout. Free database may be sleeping.',
      type: 'timeout_error'
    });
  }
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    type: 'server_error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/health',
      '/api/test',
      '/api/public/practitioners',
      '/api/public/events'
    ]
  });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Available at: http://0.0.0.0:${PORT}`);
  console.log(`💡 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

module.exports = app;
