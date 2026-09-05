const express = require('express');

const router = express.Router();

const investigationController = require('../controllers/investigationController');

router.get('/', investigationController.listInvestigations);
router.get('/:customerId', investigationController.getInvestigation);

module.exports = router;