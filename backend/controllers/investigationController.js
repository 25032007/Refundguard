const crypto = require('crypto');
const investigationService = require('../services/investigationService');

exports.getSummary = (req, res) => {
  const summary = investigationService.getSummary();
  res.json(summary);
};

exports.listInvestigations = (req, res) => {
  const result = investigationService.listInvestigations(req.query);
  res.json(result);
};

exports.getInvestigation = (req, res) => {
  const result = investigationService.analyzeCustomer(req.params.customerId);
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' }, requestId: crypto.randomUUID() });
  res.json(result);
};

exports.getRings = (req, res) => {
  const { page, pageSize } = req.query;
  const result = investigationService.getRings(page, pageSize);
  res.json(result);
};

exports.getRing = (req, res) => {
  const result = investigationService.getRing(req.params.ringId);
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ring not found' }, requestId: crypto.randomUUID() });
  res.json(result);
};

exports.getRingLifecycle = (req, res) => {
  const ring = investigationService.getRing(req.params.ringId);
  if (!ring) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ring not found' }, requestId: crypto.randomUUID() });

  const history = investigationService.getRingLifecycle(req.params.ringId);
  if (!history || history.length === 0) {
    return res.json({ lifecycle: null });
  }
  res.json({ ringId: req.params.ringId, history: history });
};