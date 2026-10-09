const express = require('express');

const router = express.Router();

const healthController = require('../controllers/healthController');
const investigationController = require('../controllers/investigationController');
const authController = require('../controllers/authController');
const auditController = require('../controllers/auditController');
const cacheManager = require('../services/cacheManager');

const investigationRoutes = require('./investigationRoutes');
const decisionRoutes = require('./decisionRoutes');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const apiRateLimiter = require('../middleware/rateLimiter');

// Rate limiting for all API v1 routes
router.use(apiRateLimiter);

// Auth endpoints
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getProfile);

// Public / Health endpoints
router.get('/health', healthController.getHealth);

// Cryptographic Audit log verification endpoint
router.get('/audit/verify', authenticateToken, auditController.verifyAuditLog);

// Cache stats endpoint
router.get('/cache/stats', authenticateToken, (req, res) => {
  res.json({ status: 'success', data: cacheManager.getStats() });
});

// Domain endpoints
router.get('/summary', authenticateToken, investigationController.getSummary);
router.get('/rings', authenticateToken, investigationController.getRings);
router.get('/rings/:ringId', authenticateToken, investigationController.getRing);
router.get('/rings/:ringId/lifecycle', authenticateToken, investigationController.getRingLifecycle);

router.use('/investigations', authenticateToken, investigationRoutes);
// We map /investigations/:customerId/decision to decisionController
router.use('/investigations', authenticateToken, decisionRoutes);

module.exports = router;