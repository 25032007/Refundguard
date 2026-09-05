/**
 * RefundGuard Complaint NLP & Evidence Extraction — public API.
 *
 * Deterministic, explainable lexical NLP. No embeddings, LLMs, or ML.
 * Independent of the risk engine, Express, MongoDB, and the frontend.
 */

const config = require('./config');
const normalize = require('./normalize');
const similarity = require('./similarity');
const evidence = require('./evidence');
const analyze = require('./analyze');

module.exports = {
  config,
  normalizeComplaintText: normalize.normalizeComplaintText,
  tokenize: normalize.tokenize,
  tokensOf: normalize.tokensOf,
  calculateSimilarity: similarity.calculateSimilarity,
  findSimilarComplaints: similarity.findSimilarComplaints,
  extractComplaintEvidence: evidence.extractComplaintEvidence,
  findRepeatedTemplates: analyze.findRepeatedTemplates,
  analyzeCustomerComplaints: analyze.analyzeCustomerComplaints,
  analyzeComplaints: analyze.analyzeComplaints,
};