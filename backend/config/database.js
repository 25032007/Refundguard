const mongoose = require('mongoose');

/**
 * Establishes a connection to MongoDB using the MONGO_URI environment variable.
 *
 * - Never throws: if MongoDB is unavailable, a clear warning is logged and the
 *   Express server continues running without a database connection.
 * - Requires MONGO_URI to be set; credentials must never be hardcoded.
 */
async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn(
      '[database] MONGO_URI is not defined. Skipping MongoDB connection.'
    );
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[database] MongoDB connected successfully');
  } catch (error) {
    console.error('[database] MongoDB connection failed:', error.message);
    console.warn(
      '[database] API server will continue running without a database connection.'
    );
  }
}

module.exports = connectDB;