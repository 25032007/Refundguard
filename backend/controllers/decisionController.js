const decisionRepository = require('../repositories/decisionRepository');
const investigationService = require('../services/investigationService');

exports.updateDecision = (req, res) => {
  const { id } = req.params;
  const analystId = req.headers['x-analyst-id'];
  const { decision, reason, expectedVersion } = req.body;

  if (!analystId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Header X-Analyst-Id required' }, requestId: Date.now() });
  }

  if (!decision || !['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'].includes(decision)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid decision state' }, requestId: Date.now() });
  }

  if ((decision === 'ESCALATED' || decision === 'CLEARED') && (!reason || reason.length < 10)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Reason must be at least 10 characters for ESCALATED or CLEARED' }, requestId: Date.now() });
  }

  try {
    const cache = investigationService.getCache();
    const customer = cache.customersById.get(id);
    if (!customer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' }, requestId: Date.now() });
    }

    const updated = decisionRepository.saveDecision(
      cache.dataset.datasetId,
      id,
      decision,
      reason,
      analystId,
      expectedVersion
    );
    res.json(updated);
  } catch (error) {
    if (error.code === 'VERSION_MISMATCH') {
      return res.status(409).json({ error: { code: 'VERSION_MISMATCH', message: 'Version mismatch' }, currentState: error.currentState, requestId: Date.now() });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message }, requestId: Date.now() });
  }
};

exports.getAuditHistory = (req, res) => {
  const { id } = req.params;
  try {
    const cache = investigationService.getCache();
    const customer = cache.customersById.get(id);
    if (!customer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' }, requestId: Date.now() });
    }

    const history = decisionRepository.getAuditHistory(cache.dataset.datasetId, id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message }, requestId: Date.now() });
  }
};
