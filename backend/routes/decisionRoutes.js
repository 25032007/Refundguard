const express = require('express');
const router = express.Router();
const decisionController = require('../controllers/decisionController');
const { decisionSchema, validateBody } = require('../middleware/validationMiddleware');

router.put('/:id/decision', validateBody(decisionSchema), decisionController.updateDecision);
router.get('/:id/history', decisionController.getAuditHistory);

module.exports = router;
