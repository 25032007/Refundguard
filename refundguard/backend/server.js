require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

// JSON body parsing
app.use(express.json());

// API versioning
const apiRouter = express.Router();

// Health route
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    project: 'RefundGuard',
  });
});

// Mount versioned API
app.use('/api/v1', apiRouter);

// Mongo connection placeholder
// TODO: Enable when database models are implemented.
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('MongoDB connected');
//   } catch (error) {
//     console.error('MongoDB connection error:', error.message);
//   }
// };

const PORT = process.env.PORT || 4000;

// Start server (no DB dependency yet - foundation only)
app.listen(PORT, () => {
  console.log(`RefundGuard backend running on http://localhost:${PORT}`);
  console.log(`API base path: /api/v1`);
});

// Export for potential testing
module.exports = app;
