const express = require('express');
const router = express.Router();
const decisionController = require('../controllers/decisionController');

router.put('/:id/decision', decisionController.updateDecision);
router.get('/:id/history', decisionController.getAuditHistory);

module.exports = router;
