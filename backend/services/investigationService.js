/**
 * Investigation Engine — orchestration layer.
 *
 * Combines the three analysis engines (risk-engine/, nlp/, graph/) into a
 * single explainable per-customer investigation. This module only touches the
 * engines' public APIs; the engines themselves are never modified.
 *
 * Deterministic by construction: engine results are already deterministic and
 * re-used from a lazily built in-memory cache, so repeated requests return
 * identical output. Nothing is persisted and no ground-truth clusters.json is
 * ever read by the analysis path.
 */

const fs = require('fs');
const path = require('path');

const riskEngine = require('../../risk-engine');
const nlp = require('../../nlp');
const graphEngine = require('../../graph');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw');

const LEVEL_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

const RECOMMENDATIONS = {
  low: 'No immediate action.',
  medium: 'Monitor customer.',
  high: 'Manual investigation recommended.',
  critical: 'Escalate to fraud analyst.',
};

function loadDataset() {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, name), 'utf8'));
  return {
    customers: read('customers.json'),
    devices: read('devices.json'),
    transactions: read('transactions.json'),
    refunds: read('refunds.json'),
    complaints: read('complaints.json'),
  };
}

function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Highest of two severity/risk levels; baseline defaults to 'low'. */
function highestLevel(a, b) {
  const va = a ? LEVEL_ORDER[a] : 0;
  const vb = b ? LEVEL_ORDER[b] : 0;
  return va >= vb ? a : b;
}

/**
 * overallRisk = CRITICAL whenever the customer sits in a CRITICAL refund
 * ring; otherwise the highest of the risk-engine level and the graph level.
 */
function computeOverallRisk(riskLevel, ring) {
  if (ring && ring.severity === 'critical') return 'critical';
  return highestLevel(riskLevel, ring ? ring.severity : 'low');
}

// ---------------------------------------------------------------------------
// Cache: the full analysis is computed once on first use and reused for the
// lifetime of the process (in-memory only — no persistence).
// ---------------------------------------------------------------------------

let analysisCache = null;

function buildAnalysisCache() {
  if (analysisCache) return analysisCache;

  const dataset = loadDataset();

  const riskResults = riskEngine.analyzeAllCustomers(dataset);
  const riskById = new Map(riskResults.map((r) => [r.customerId, r]));

  const nlpReport = nlp.analyzeComplaints(dataset.complaints);
  const nlpById = new Map(nlpReport.perCustomerResults.map((r) => [r.customerId, r]));
  const similarPairs = nlp.findSimilarComplaints(dataset.complaints);
  const templates = nlp.findRepeatedTemplates(dataset.complaints);

  const ringReport = graphEngine.analyzeRefundRings(dataset);
  const ringByMember = new Map();
  for (const ring of ringReport.rings) {
    for (const member of ring.customerIds) ringByMember.set(member, ring);
  }

  const customersById = new Map(dataset.customers.map((c) => [c.customerId, c]));

  analysisCache = {
    dataset,
    customersById,
    riskById,
    nlpById,
    similarPairs,
    templates,
    ringByMember,
  };
  return analysisCache;
}

// ---------------------------------------------------------------------------
// Per-customer investigation assembly.
// ---------------------------------------------------------------------------

function buildNlpSection(customerId, cache) {
  const nlpResult = cache.nlpById.get(customerId);
  const similar = cache.similarPairs
    .filter(
      (p) =>
        (p.customerIdA === customerId && p.customerIdB !== customerId) ||
        (p.customerIdB === customerId && p.customerIdA !== customerId)
    )
    .map((p) => {
      const isA = p.customerIdA === customerId;
      return {
        customerId,
        complaintId: isA ? p.complaintIdA : p.complaintIdB,
        similarCustomerId: isA ? p.customerIdB : p.customerIdA,
        similarComplaintId: isA ? p.complaintIdB : p.complaintIdA,
        similarity: Math.round(p.similarity * 1000) / 1000,
      };
    })
    .sort(
      (a, b) =>
        b.similarity - a.similarity ||
        compareIds(a.complaintId, b.complaintId) ||
        compareIds(a.similarComplaintId, b.similarComplaintId)
    );

  const mineIds = new Set(
    (cache.dataset.complaints || [])
      .filter((c) => c && c.customerId === customerId)
      .map((c) => c.complaintId)
  );
  const repeatedTemplates = cache.templates
    .filter((t) => t.customerIds.length >= 2 && t.complaintIds.some((id) => mineIds.has(id)))
    .map((t) => ({
      templateKey: t.templateKey,
      count: t.count,
      customerIds: t.customerIds,
      representativeText: t.representativeText,
    }));

  const { evidence = { categories: [], keywords: [], phrases: [] } } = nlpResult || {};
  const evidenceList = [
    ...evidence.categories.map((value) => ({ type: 'category', value })),
    ...evidence.keywords.map((value) => ({ type: 'keyword', value })),
    ...evidence.phrases.map((value) => ({ type: 'phrase', value })),
  ];

  return {
    complaintCount: nlpResult ? nlpResult.complaintCount : 0,
    repeatedTemplates,
    similarComplaints: similar,
    evidence: evidenceList,
  };
}

function buildGraphSection(customerId, cache) {
  const ring = cache.ringByMember.get(customerId);
  if (!ring) return { inRing: false, ringId: null, ringScore: null, members: [], evidence: [] };

  const evidence = [];
  if (ring.evidence.sharedIps.length) {
    for (const g of ring.evidence.sharedIps) {
      evidence.push(`shared IP ${g.ip}: ${g.customers.join(', ')}`);
    }
  }
  if (ring.evidence.sharedDevices.length) {
    for (const g of ring.evidence.sharedDevices) {
      evidence.push(`shared device ${g.deviceId}: ${g.customers.join(', ')}`);
    }
  }
  evidence.push(
    `refund rate ${(ring.evidence.ringRefundRate * 100).toFixed(0)}% (${ring.evidence.ringRefunds}/${ring.evidence.ringTransactions} transactions)`
  );
  evidence.push(
    `members with refunds: ${ring.evidence.membersWithRefunds}/${ring.memberCount}; members with complaints: ${ring.evidence.membersWithComplaints}/${ring.memberCount}`
  );

  return {
    inRing: true,
    ringId: ring.ringId,
    ringScore: ring.score,
    members: ring.customerIds,
    evidence,
  };
}

function buildSummary(risk, nlpResult, graphSection, ring, overall) {
  const parts = [];
  if (ring && ring.severity === 'critical') {
    parts.push(
      `customer belongs to critical refund ring ${ring.ringId} (${ring.memberCount} members, ring score ${ring.score})`
    );
  } else if (risk && risk.score > 0) {
    parts.push(`${risk.level} behavior risk score ${risk.score}`);
  }
  if (nlpResult) {
    if (nlpResult.complaintCount > 0) {
      parts.push(`${nlpResult.complaintCount} complaint${nlpResult.complaintCount === 1 ? '' : 's'}`);
      if (nlpResult.similarComplaintCount > 0) {
        parts.push(`${nlpResult.similarComplaintCount} similar to other customers`);
      }
      if (nlpResult.repeatedTemplateCount > 0) {
        parts.push(`${nlpResult.repeatedTemplateCount} reused wording template${nlpResult.repeatedTemplateCount === 1 ? '' : 's'}`);
      }
    }
  }
  if (graphSection.inRing && !(ring && ring.severity === 'critical')) {
    parts.push(`connected to ${graphSection.members.length - 1} other customers through shared resources`);
  }
  if (parts.length === 0) {
    parts.push('no suspicious refund, complaint, or network behavior detected');
  }

  return `Overall risk ${overall.toUpperCase()}: ${parts.join('; ')}. ${RECOMMENDATIONS[overall]}`;
}

/**
 * Merges all engine results for one customer into the public investigation
 * shape. Returns null when the customer does not exist.
 */
function analyzeCustomer(customerId) {
  const cache = buildAnalysisCache();
  const customer = cache.customersById.get(customerId);
  if (!customer) return null;

  const risk = cache.riskById.get(customerId) || { score: 0, level: 'low', signals: [] };
  const nlpResult = cache.nlpById.get(customerId) || null;
  const ring = cache.ringByMember.get(customerId) || null;

  const riskSection = { score: risk.score, level: risk.level, signals: risk.signals };
  const nlpSection = buildNlpSection(customerId, cache);
  const graphSection = buildGraphSection(customerId, cache);

  const overall = computeOverallRisk(risk.level, ring);
  const summary = {
    overallRisk: overall,
    recommendation: RECOMMENDATIONS[overall],
    explanation: buildSummary(risk, nlpResult, graphSection, ring, overall),
  };

  return {
    customer,
    risk: riskSection,
    nlp: nlpSection,
    graph: graphSection,
    summary,
  };
}

/**
 * Every customer as a full investigation, sorted by overall risk (critical →
 * low), then behavior risk score desc, then customerId asc. Deterministic.
 */
function analyzeAllCustomers() {
  const cache = buildAnalysisCache();
  return cache.dataset.customers
    .map((c) => analyzeCustomer(c.customerId))
    .sort((a, b) => {
      const levelDiff = LEVEL_ORDER[b.summary.overallRisk] - LEVEL_ORDER[a.summary.overallRisk];
      if (levelDiff !== 0) return levelDiff;
      const scoreDiff = b.risk.score - a.risk.score;
      if (scoreDiff !== 0) return scoreDiff;
      return compareIds(a.customer.customerId, b.customer.customerId);
    });
}

module.exports = { analyzeCustomer, analyzeAllCustomers };