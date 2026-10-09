const fs = require('fs');
const path = require('path');
const riskEngine = require('../../risk-engine');
const nlp = require('../../nlp');
const graphEngine = require('../../graph');
const decisionRepository = require('../repositories/decisionRepository');

const LEVEL_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

const SIGNAL_LABELS = {
  refund_frequency: 'Refund Frequency',
  refund_rate: 'Refund Rate',
  refund_velocity: 'Refund Velocity',
  repeated_refund_reason: 'Repeated Refund Reason',
  shared_ip: 'Shared IP Address',
  shared_device: 'Shared Device'
};

function humanizeSignalType(type) {
  return String(type)
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function signalLabel(type) {
  if (!type) return null;
  return SIGNAL_LABELS[type] || humanizeSignalType(type);
}

const RECOMMENDATIONS = {
  LOW: 'No immediate action.',
  MEDIUM: 'Monitor customer.',
  HIGH: 'Manual investigation recommended.',
  CRITICAL: 'Escalate to fraud analyst.',
};

function loadDataset() {
  const dataDir = process.env.REFUNDGUARD_DATA_DIR ? path.resolve(process.env.REFUNDGUARD_DATA_DIR) : path.join(__dirname, '..', '..', 'data', 'raw');

  const read = (name) => {
    const filePath = path.join(dataDir, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required dataset file: ${name} in ${dataDir}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  };

  const dataset = {
    customers: read('customers.json'),
    devices: read('devices.json'),
    transactions: read('transactions.json'),
    refunds: read('refunds.json'),
    complaints: read('complaints.json'),
  };

  try {
    const metaPath = path.join(dataDir, 'metadata.json');
    dataset.metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!dataset.metadata.customerCount) {
      dataset.metadata.customerCount = dataset.metadata.totalCustomerCount || dataset.customers.length;
    }
  } catch (e) {
    dataset.metadata = { source: 'default', seed: 0, customerCount: dataset.customers.length };
  }

  dataset.datasetId = `${dataset.metadata.source}_${dataset.metadata.seed}`;
  return dataset;
}

function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function highestLevel(a, b) {
  const va = a ? LEVEL_ORDER[a] : 0;
  const vb = b ? LEVEL_ORDER[b] : 0;
  return va >= vb ? a : b;
}

function computeOverallRisk(riskLevel, ring) {
  const normalizedRisk = (riskLevel || 'LOW').toUpperCase();
  if (ring && ring.severity.toUpperCase() === 'CRITICAL') return 'CRITICAL';
  return highestLevel(normalizedRisk, ring ? ring.severity.toUpperCase() : 'LOW');
}

let analysisCache = null;
let precomputedList = [];
let precomputedRings = [];
let buildTimeMs = 0;

function getCache() {
  if (!analysisCache) {
    buildAnalysisCache();
  }
  return analysisCache;
}

function selectSnapshotDates(transactions, maxSnapshots = 10) {
  const validDates = transactions
    .map(t => (t.createdAt && typeof t.createdAt === 'string' ? t.createdAt.substring(0, 10) : null))
    .filter(d => d !== null);

  const uniqueDates = Array.from(new Set(validDates)).sort();
  if (uniqueDates.length === 0) return [];

  let snapshotTimes = [];
  if (uniqueDates.length <= maxSnapshots) {
    snapshotTimes = uniqueDates.map(d => `${d}T23:59:59.999Z`);
  } else {
    for (let i = 0; i < maxSnapshots; i++) {
      const index = Math.floor(i * (uniqueDates.length - 1) / (maxSnapshots - 1));
      snapshotTimes.push(`${uniqueDates[index]}T23:59:59.999Z`);
    }
    snapshotTimes = Array.from(new Set(snapshotTimes)).sort();
  }
  return snapshotTimes;
}

function buildAnalysisCache() {
  const startTime = Date.now();
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

  const lifecycleByRingId = new Map();
  const snapshotTimes = selectSnapshotDates(dataset.transactions);

  if (snapshotTimes.length > 0) {
    const lifecycleAnalysis = graphEngine.analyzeRingLifecycle(dataset, snapshotTimes);

    for (const snap of lifecycleAnalysis.snapshots) {
      for (const ring of snap.rings) {
        if (!lifecycleByRingId.has(ring.ringId)) {
          lifecycleByRingId.set(ring.ringId, []);
        }
        lifecycleByRingId.get(ring.ringId).push({
          lastSeenAt: ring.lastSeenAt,
          state: ring.state,
          evidenceTriggers: ring.evidenceTriggers || []
        });
      }
    }
  }

  analysisCache = {
    dataset,
    customersById,
    riskById,
    nlpById,
    similarPairs,
    templates,
    ringByMember,
    rings: ringReport.rings,
    lifecycleByRingId
  };

  precomputeListRows();
  precomputedRings = ringReport.rings.sort((a, b) => b.score - a.score);

  buildTimeMs = Date.now() - startTime;
  return analysisCache;
}

function precomputeListRows() {
  const cache = analysisCache;
  const list = [];

  for (const customer of cache.dataset.customers) {
    const customerId = customer.customerId;
    const risk = cache.riskById.get(customerId) || { score: 0, level: 'low', signals: [] };
    const nlpResult = cache.nlpById.get(customerId) || null;
    const ring = cache.ringByMember.get(customerId) || null;

    const riskLevel = computeOverallRisk(risk.level, ring);

    let topSignal = null;
    if (risk.signals && risk.signals.length > 0) {
      const sortedSignals = [...risk.signals].sort((a, b) => b.contribution - a.contribution);
      topSignal = sortedSignals[0];
    }

    list.push({
      customerId,
      riskScore: risk.score,
      riskLevel: riskLevel,
      topSignal: topSignal ? { type: topSignal.type, label: signalLabel(topSignal.type), contribution: topSignal.contribution } : null,
      complaintCount: nlpResult ? nlpResult.complaintCount : 0,
      ring: ring ? { ringId: ring.ringId, score: ring.score } : null
    });
  }

  precomputedList = list;
}

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
  if (ring && ring.severity.toUpperCase() === 'CRITICAL') {
    parts.push(
      `customer belongs to critical refund ring ${ring.ringId} (${ring.memberCount} members, ring score ${ring.score})`
    );
  } else if (risk && risk.score > 0) {
    parts.push(`${risk.level.toUpperCase()} behavior risk score ${risk.score}`);
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
  if (graphSection.inRing && !(ring && ring.severity.toUpperCase() === 'CRITICAL')) {
    parts.push(`connected to ${graphSection.members.length - 1} other customers through shared resources`);
  }
  if (parts.length === 0) {
    parts.push('no suspicious refund, complaint, or network behavior detected');
  }

  return `Overall risk ${overall}: ${parts.join('; ')}. ${RECOMMENDATIONS[overall]}`;
}

function analyzeCustomer(customerId) {
  const cache = getCache();
  const customer = cache.customersById.get(customerId);
  if (!customer) return null;

  const risk = cache.riskById.get(customerId) || { score: 0, level: 'LOW', signals: [] };
  const nlpResult = cache.nlpById.get(customerId) || null;
  const ring = cache.ringByMember.get(customerId) || null;

  const riskSection = { score: risk.score, level: (risk.level || 'LOW').toUpperCase(), signals: risk.signals };
  const nlpSection = buildNlpSection(customerId, cache);
  const graphSection = buildGraphSection(customerId, cache);

  const overall = computeOverallRisk(risk.level, ring);
  const summary = {
    overallRisk: overall,
    recommendation: RECOMMENDATIONS[overall],
    explanation: buildSummary(riskSection, nlpResult, graphSection, ring, overall),
  };

  const decisionRecord = decisionRepository.getDecision(cache.dataset.datasetId, customerId);
  const decision = decisionRecord ? { status: decisionRecord.status, updatedAt: decisionRecord.updatedAt } : { status: 'UNREVIEWED', updatedAt: null };

  return {
    customer,
    risk: riskSection,
    nlp: nlpSection,
    graph: graphSection,
    summary,
    decision,
    version: decisionRecord ? decisionRecord.version : 0
  };
}

function listInvestigations(options) {
  const cache = getCache();
  const scope = options.scope || 'flagged';
  const risk = (options.risk || options.riskLevel || '').toUpperCase();
  const status = (options.status || options.decision || '').toUpperCase();
  const q = (options.q || options.search || options.query || '').toLowerCase();
  const inRing = options.inRing !== undefined ? options.inRing : options.ring;
  const sort = options.sort || '-score';
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;

  const dbDecisions = decisionRepository.getDecisionsForDataset(cache.dataset.datasetId);
  const statusMap = new Map(dbDecisions.map(d => [d.customerId, d.decision]));

  const validPageSize = Math.min(Math.max(1, parseInt(pageSize, 10)), 100);
  const validPage = Math.max(1, parseInt(page, 10));

  const facets = {
    risk: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    riskLevel: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    status: { UNREVIEWED: 0, MONITOR: 0, ESCALATED: 0, CLEARED: 0 },
    inRing: { true: 0, false: 0 },
    ring: { inRing: 0, noRing: 0 }
  };

  let filtered = [];

  for (const row of precomputedList) {
    const rowStatus = statusMap.get(row.customerId) || 'UNREVIEWED';

    // Default scope = flagged (MEDIUM or higher)
    if (scope === 'flagged' && LEVEL_ORDER[row.riskLevel] < LEVEL_ORDER.MEDIUM) continue;

    // Search query matching
    if (q) {
      const matchCust = row.customerId.toLowerCase().includes(q);
      const matchSignal = row.topSignal && row.topSignal.label && row.topSignal.label.toLowerCase().includes(q);
      const matchRing = row.ring && row.ring.ringId && row.ring.ringId.toLowerCase().includes(q);
      if (!matchCust && !matchSignal && !matchRing) continue;
    }

    const matchRisk = !risk || risk === 'ALL' || row.riskLevel === risk;
    const matchStatus = !status || status === 'ALL' || rowStatus === status;

    let matchRing = true;
    if (inRing !== undefined && inRing !== 'ALL' && inRing !== 'any') {
      if (inRing === 'IN_RING' || inRing === 'true' || inRing === true) {
        matchRing = !!row.ring;
      } else if (inRing === 'NO_RING' || inRing === 'false' || inRing === false || inRing === 'none') {
        matchRing = !row.ring;
      } else {
        matchRing = row.ring && row.ring.ringId === inRing;
      }
    }

    if (matchStatus && matchRing) {
      facets.risk[row.riskLevel] = (facets.risk[row.riskLevel] || 0) + 1;
      facets.riskLevel[row.riskLevel] = (facets.riskLevel[row.riskLevel] || 0) + 1;
    }
    if (matchRisk && matchRing) {
      facets.status[rowStatus] = (facets.status[rowStatus] || 0) + 1;
    }
    if (matchRisk && matchStatus) {
      if (row.ring) {
        facets.inRing.true++;
        facets.ring.inRing++;
      } else {
        facets.inRing.false++;
        facets.ring.noRing++;
      }
    }

    if (matchRisk && matchStatus && matchRing) {
      filtered.push({
        ...row,
        decision: { status: rowStatus, updatedAt: null }
      });
    }
  }

  // Sort
  filtered.sort((a, b) => {
    let scoreDiff = 0;
    if (sort === '-score') scoreDiff = b.riskScore - a.riskScore;
    else if (sort === 'score') scoreDiff = a.riskScore - b.riskScore;

    if (scoreDiff !== 0) return scoreDiff;

    // then ring score desc
    const aRing = a.ring ? a.ring.score : -1;
    const bRing = b.ring ? b.ring.score : -1;
    if (bRing !== aRing) return bRing - aRing;

    // then customerId asc
    return compareIds(a.customerId, b.customerId);
  });

  // Also populate updatedAt from full DB fetch if needed, but the prompt says
  // "decision:{status,updatedAt}". To be efficient we can fetch timestamps from DB
  const pageItems = filtered.slice((validPage - 1) * validPageSize, validPage * validPageSize);

  // Attach exact updatedAt for the page
  for (const item of pageItems) {
    const d = decisionRepository.getDecision(cache.dataset.datasetId, item.customerId);
    if (d) {
      item.decision.updatedAt = d.updatedAt;
    }
  }

  return {
    items: pageItems,
    page: validPage,
    pageSize: validPageSize,
    total: filtered.length,
    facets
  };
}

function getSummary() {
  const cache = getCache();

  const dbDecisions = decisionRepository.getDecisionsForDataset(cache.dataset.datasetId);
  const statusMap = new Map(dbDecisions.map(d => [d.customerId, d.decision]));

  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const decisionCounts = { UNREVIEWED: 0, MONITOR: 0, ESCALATED: 0, CLEARED: 0 };
  const signalMap = new Map();

  for (const row of precomputedList) {
    riskCounts[row.riskLevel]++;
    const status = statusMap.get(row.customerId) || 'UNREVIEWED';
    decisionCounts[status]++;

    if (row.topSignal) {
      const key = row.topSignal.type;
      const count = (signalMap.get(key) || 0) + 1;
      signalMap.set(key, count);
    }
  }

  const topSignals = Array.from(signalMap.entries())
    .map(([type, count]) => {
      return { type, label: signalLabel(type), count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    dataset: cache.dataset.metadata,
    risk: riskCounts,
    decisions: decisionCounts,
    rings: {
      total: cache.rings.length,
      byLifecycle: computeRingsLifecycleSummary(cache.rings, cache.lifecycleByRingId)
    },
    topSignals
  };
}

function computeRingsLifecycleSummary(rings, lifecycleByRingId) {
  if (!lifecycleByRingId) return null;
  const byLifecycle = { EMERGING: 0, ACTIVE: 0, DORMANT: 0, DISBANDED: 0, UNTRACKED: 0 };
  for (const ring of rings) {
    const history = lifecycleByRingId.get(ring.ringId);
    if (history && history.length > 0) {
      const state = history[history.length - 1].state.toUpperCase();
      if (byLifecycle[state] !== undefined) {
        byLifecycle[state]++;
      } else {
        byLifecycle[state] = 1;
      }
    } else {
      byLifecycle['UNTRACKED']++;
    }
  }
  return byLifecycle;
}

function getHealth() {
  const cache = analysisCache;
  return {
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    datasetLoaded: !!cache,
    db: 'sqlite',
    dataset: cache ? cache.dataset.metadata : null,
    datasetId: cache ? cache.dataset.datasetId : null,
    coldBuildMs: buildTimeMs
  };
}

function toRingSummary(ring) {
  const { relationshipEdges, ...rest } = ring;
  return { ...rest, edgeCount: Array.isArray(relationshipEdges) ? relationshipEdges.length : 0 };
}

function buildRingGraph(ring) {
  const nodes = [];
  const links = [];
  const nodeIndex = new Map();

  const ensureNode = (id, type, ringMember = false) => {
    const existing = nodeIndex.get(id);
    if (existing) {
      if (ringMember) existing.ringMember = true;
      return existing;
    }
    const node = { id, type, ringMember };
    nodeIndex.set(id, node);
    nodes.push(node);
    return node;
  };

  for (const customerId of ring.customerIds || []) {
    ensureNode(customerId, 'customer', true);
  }

  for (const group of (ring.evidence && ring.evidence.sharedIps) || []) {
    ensureNode(group.ip, 'ip');
    for (const customerId of group.customers) {
      ensureNode(customerId, 'customer');
      links.push({ source: customerId, target: group.ip, type: 'shared_ip' });
    }
  }

  for (const group of (ring.evidence && ring.evidence.sharedDevices) || []) {
    ensureNode(group.deviceId, 'device');
    for (const customerId of group.customers) {
      ensureNode(customerId, 'customer');
      links.push({ source: customerId, target: group.deviceId, type: 'shared_device' });
    }
  }

  return { nodes, links };
}

function getRings(page = 1, pageSize = 50) {
  const cache = getCache();
  const validPageSize = Math.min(Math.max(1, parseInt(pageSize, 10)), 100);
  const validPage = Math.max(1, parseInt(page, 10));

  const items = precomputedRings
    .slice((validPage - 1) * validPageSize, validPage * validPageSize)
    .map(toRingSummary);

  return {
    items,
    page: validPage,
    pageSize: validPageSize,
    total: precomputedRings.length
  };
}

function getRing(ringId) {
  const cache = getCache();
  const ring = cache.rings.find(r => r.ringId === ringId);
  if (!ring) return null;
  return { ...toRingSummary(ring), graph: buildRingGraph(ring) };
}

function getRingLifecycle(ringId) {
  const cache = getCache();
  if (!cache || !cache.lifecycleByRingId) return null;
  return cache.lifecycleByRingId.get(ringId) || null;
}

module.exports = {
  analyzeCustomer,
  listInvestigations,
  getSummary,
  getHealth,
  getRings,
  getRing,
  getRingLifecycle,
  getCache,
  selectSnapshotDates
};