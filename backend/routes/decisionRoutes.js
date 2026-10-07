const express = require('express');
const router = express.Router();
const decisionController = require('../controllers/decisionController');

router.get('/:id', decisionController.getDecision);
router.post('/:id', decisionController.updateDecision);
router.get('/:id/audit', decisionController.getAuditHistory);

module.exports = router;
