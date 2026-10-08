require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const apiRoutes = require('./routes');
const investigationService = require('./services/investigationService');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);
app.use(express.json());

app.use('/api/v1', apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(err.status || 500).json({
    error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' },
  });
});

const PORT = process.env.PORT || 5000;

// Precompute cache
investigationService.getCache();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RefundGuard backend running on http://localhost:${PORT}`);
    console.log('API base path: /api/v1');
  });
}

module.exports = app;