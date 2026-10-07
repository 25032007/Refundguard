const decisionService = require('../services/decisionService');

exports.getDecision = (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'entityId is required' });
    const decision = decisionService.getDecision(id);
    res.status(200).json(decision);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateDecision = (req, res) => {
  try {
    const { id } = req.params;
    const { decision, analystId, reason, timestamp } = req.body;
    if (!id) return res.status(400).json({ error: 'entityId is required' });
    if (!decision) return res.status(400).json({ error: 'decision is required' });

    const updated = decisionService.updateDecision(id, decision, analystId, reason, timestamp);
    res.status(200).json(updated);
  } catch (error) {
    if (error.message.startsWith('Invalid')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

exports.getAuditHistory = (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'entityId is required' });
    const history = decisionService.getAuditHistory(id);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
