/**
 * Graph-Based Refund Ring Detection Engine — public API.
 *
 * Independent of the risk signal engine (risk-engine/) and the complaint NLP
 * layer (nlp/). This module exposes the full ring-analysis pipeline and never
 * reads ground-truth cluster definitions.
 */

const config = require('./config');
const { buildGraph } = require('./buildGraph');
const { findConnectedComponents } = require('./components');
const {
  buildCustomerGraph,
  detectRingCandidates,
} = require('./detectRings');
const { extractRingEvidence } = require('./evidence');
const { scoreRing } = require('./scoreRing');

/**
 * Detect, explain, and score coordinated refund rings from raw entity data.
 *
 * @param {object} dataset { customers, devices, transactions, refunds, complaints }
 * @returns {{
 *   graphStats: object,
 *   componentCount: number,
 *   candidateCount: number,
 *   rings: Array<object>
 * }}
 */
function analyzeRefundRings(dataset) {
  const graph = buildGraph(dataset);
  const customerGraph = buildCustomerGraph(graph);
  const components = findConnectedComponents(customerGraph);
  const candidates = detectRingCandidates(customerGraph, { components });

  const rings = candidates.map((candidate) => {
    const evidence = extractRingEvidence(candidate, graph);
    const scored = scoreRing(candidate, evidence);
    return {
      ...candidate,
      evidence,
      score: scored.score,
      severity: scored.severity,
      signals: scored.signals,
    };
  });

  rings.sort((a, b) =>
    b.score - a.score || b.memberCount - a.memberCount || (a.ringId < b.ringId ? -1 : 1)
  );

  return {
    graphStats: graph.stats,
    componentCount: components.length,
    candidateCount: rings.length,
    rings,
  };
}

module.exports = {
  config,
  analyzeRefundRings,
  buildGraph,
  buildCustomerGraph,
  findConnectedComponents,
  detectRingCandidates,
  extractRingEvidence,
  scoreRing,
};