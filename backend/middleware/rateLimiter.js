const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 5000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please slow down',
      },
      requestId: crypto.randomUUID(),
    });
  },
  skip: (req) => process.env.NODE_ENV === 'test', // Skip in automated tests for speed
});

module.exports = apiRateLimiter;
