require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/database');
const apiRoutes = require('./routes');

const app = express();

// Global middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// API versioning
app.use('/api/v1', apiRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

// Attempt DB connection; failure is non-fatal by design.
connectDB();

app.listen(PORT, () => {
  console.log(`RefundGuard backend running on http://localhost:${PORT}`);
  console.log('API base path: /api/v1');
});

module.exports = app;