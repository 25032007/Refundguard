const express = require('express');

const router = express.Router();

const healthController = require('../controllers/healthController');
const investigationRoutes = require('./investigationRoutes');
const decisionRoutes = require('./decisionRoutes');

router.get('/health', healthController.getHealth);

router.use('/investigations', investigationRoutes);
router.use('/decisions', decisionRoutes);

module.exports = router;