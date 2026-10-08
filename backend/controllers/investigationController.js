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
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' }, requestId: Date.now() });
  res.json(result);
};

exports.getRings = (req, res) => {
  const { page, pageSize } = req.query;
  const result = investigationService.getRings(page, pageSize);
  res.json(result);
};

exports.getRing = (req, res) => {
  const result = investigationService.getRing(req.params.ringId);
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ring not found' }, requestId: Date.now() });
  res.json(result);
};

exports.getRingLifecycle = (req, res) => {
  const result = investigationService.getRingLifecycle(req.params.ringId);
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ring not found' }, requestId: Date.now() });
  res.json({ ringId: req.params.ringId, history: result });
};