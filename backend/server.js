require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const apiRoutes = require('./routes');
const investigationService = require('./services/investigationService');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // Allows force-graph and inline assets
  })
);
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());

// API Endpoints
app.use('/api/v1', apiRoutes);

// Static Serving for Frontend Build Bundle
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
      requestId: crypto.randomUUID(),
    });
  });
}

// Global Error Handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(err.status || 500).json({
    error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Internal server error' },
    requestId: crypto.randomUUID(),
  });
});

const PORT = process.env.PORT || 5000;

// Precompute cache
investigationService.getCache();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RefundGuard backend running on port ${PORT}`);
    console.log(`API base path: /api/v1`);
  });
}

module.exports = app;