const express = require('express');

const router = express.Router();

const healthController = require('../controllers/healthController');
const investigationController = require('../controllers/investigationController');
const investigationRoutes = require('./investigationRoutes');
const decisionRoutes = require('./decisionRoutes');

router.get('/health', healthController.getHealth);
router.get('/summary', investigationController.getSummary);
router.get('/rings', investigationController.getRings);
router.get('/rings/:ringId', investigationController.getRing);
router.get('/rings/:ringId/lifecycle', investigationController.getRingLifecycle);

router.use('/investigations', investigationRoutes);
// We map /investigations/:customerId/decision to decisionController
router.use('/investigations', decisionRoutes);

module.exports = router;