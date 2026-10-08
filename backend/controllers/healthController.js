const investigationService = require('../services/investigationService');

exports.getHealth = (req, res) => {
  res.json(investigationService.getHealth());
};