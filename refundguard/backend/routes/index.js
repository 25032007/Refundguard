const express = require('express');

const router = express.Router();

const healthController = require('../controllers/healthController');
const investigationRoutes = require('./investigationRoutes');

router.get('/health', healthController.getHealth);

router.use('/investigations', investigationRoutes);

module.exports = router;