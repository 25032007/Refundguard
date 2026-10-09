const decisionService = require('../services/decisionService');

exports.verifyAuditLog = (req, res) => {
  const result = decisionService.verifyAuditChain();
  res.json({
    status: 'success',
    data: result,
  });
};
