// File: server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const practitionerRoutes = require('./routes/practitionerRoutes');
const eventRoutes = require('./routes/eventRoutes');
const employeeRoutes = require('./routes/employeeRoutes'); // Add this line
const uploadRoutes = require('./routes/uploadRoutes');
const { authenticateToken } = require('./middleware/authMiddleware');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/practitioners', practitionerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/employees', employeeRoutes); // Add this line
app.use('/api/upload', uploadRoutes);

// Public routes that don't need authentication
app.use('/api/public/practitioners', require('./routes/publicPractitionerRoutes'));
app.use('/api/public/events', require('./routes/publicEventRoutes'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;