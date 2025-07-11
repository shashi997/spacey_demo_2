const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const chatRoutes = require('./routes/chatRoutes');


const app = express();

// Middleware
app.use(express.json({ limit: '10mb' })); // Increased from default 100kb to support conversation history
app.use(cors());

// Add some debug logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.get('/', (req, res) => {
  res.send('Hello from the Spacey Tutor server!');
});

// Routes
app.use('/api/chat', chatRoutes);

// Global error handler
app.use((error, req, res, next) => {
    console.error('🔥 Global error handler caught:', error);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

// Start Server
const PORT = process.env.PORT || 5000; // Use PORT from .env or default to 5000
app.listen(PORT, () => {
    console.log(`🚀 Spacey Tutor server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api/chat`);
});