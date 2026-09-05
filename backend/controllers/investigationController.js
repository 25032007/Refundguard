/**
 * Investigation API handlers. Thin HTTP layer over investigationService; no
 * auth, pagination, or persistence — the service is the single source of
 * results and they are computed deterministically on demand.
 */
const investigationService = require('../services/investigationService');

/**
 * GET /api/v1/investigations — all customers as investigations, sorted by
 * overall risk (highest first).
 */
exports.listInvestigations = (req, res) => {
  const investigations = investigationService.analyzeAllCustomers();
  res.status(200).json(investigations);
};

/**
 * GET /api/v1/investigations/:customerId — merged investigation for one
 * customer. 404 when the customer is unknown.
 */
exports.getInvestigation = (req, res) => {
  const { customerId } = req.params;
  const investigation = investigationService.analyzeCustomer(customerId);
  if (!investigation) {
    return res.status(404).json({ error: `Customer not found: ${customerId}` });
  }
  return res.status(200).json(investigation);
};