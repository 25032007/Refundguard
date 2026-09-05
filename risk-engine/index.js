/**
 * RefundGuard Explainable Risk Signal Engine.
 *
 * Deterministic, rule-based analysis of customer refund behavior. For each
 * customer the engine evaluates six signals, sums their contributions into a
 * 0-100 score, and maps the score to a risk level.
 *
 * The engine is deliberately independent of Express, MongoDB, and the UI. It
 * consumes plain structured data:
 *
 *   dataset = {
 *     customers:    [...],   // customerId, status, createdAt, ...
 *     transactions: [...],   // customerId, orderId, deviceId, ipAddress, status, createdAt
 *     refunds:      [...],   // customerId, transactionId, reason, requestedAt, ...
 *     complaints:   [...],   // customerId, orderId, refundId, text, ...
 *     devices:      [...],   // deviceId, customerId, ...
 *   }
 *
 * Every returned signal includes type, severity, contribution, description,
 * and evidence so an analyst can always understand WHY a customer was flagged.
 *
 * Ground truth (generator cluster membership) is NEVER read here: the engine
 * must discover suspicious behavior from the actual records.
 */

const config = require('./config');
const signals = require('./signals');
const { clamp, riskLevel, compareByScoreDesc } = require('./utils/scoring');
const { toMs } = require('./utils/dates');

/**
 * Builds dataset-wide lookup structures shared across signals:
 *  - ipCustomers:     ipAddress -> Set(customerId)   (from transactions)
 *  - deviceCustomers: deviceId -> Set(customerId)    (from transactions)
 *  - now:             deterministic analysis time = latest refund request in
 *                     the dataset (fallback: epoch 0, never the system clock)
 */
function buildContext(dataset) {
  const ipCustomers = new Map();
  const deviceCustomers = new Map();

  for (const t of dataset.transactions || []) {
    if (!t.customerId) continue;
    if (t.ipAddress) {
      if (!ipCustomers.has(t.ipAddress)) ipCustomers.set(t.ipAddress, new Set());
      ipCustomers.get(t.ipAddress).add(t.customerId);
    }
    if (t.deviceId) {
      if (!deviceCustomers.has(t.deviceId)) deviceCustomers.set(t.deviceId, new Set());
      deviceCustomers.get(t.deviceId).add(t.customerId);
    }
  }

  let nowTs = 0;
  for (const r of dataset.refunds || []) {
    const ts = toMs(r.requestedAt);
    if (ts > nowTs) nowTs = ts;
  }
  if (!nowTs) {
    for (const c of dataset.customers || []) {
      const ts = toMs(c.createdAt);
      if (ts > nowTs) nowTs = ts;
    }
  }

  return { ipCustomers, deviceCustomers, now: new Date(nowTs) };
}

function collectCustomerRecords(customerId, dataset) {
  return {
    customer: dataset.customers.find((c) => c.customerId === customerId) || null,
    transactions: (dataset.transactions || []).filter((t) => t.customerId === customerId),
    refunds: (dataset.refunds || []).filter((r) => r.customerId === customerId),
    complaints: (dataset.complaints || []).filter((c) => c.customerId === customerId),
    devices: (dataset.devices || []).filter((d) => d.customerId === customerId),
  };
}

/**
 * Evaluates every enabled signal for one customer and returns the matching
 * signal objects (each fully explainable).
 */
function evaluateSignals(base, ctx) {
  const results = [
    signals.refundFrequency.evaluate(base, ctx),
    signals.refundRate.evaluate(base, ctx),
    signals.refundVelocity.evaluate(base, ctx),
    signals.repeatedReason.evaluate(base, ctx),
    signals.sharedIp.evaluate(base, ctx),
    signals.sharedDevice.evaluate(base, ctx),
  ];
  return results.filter((signal) => signal !== null);
}

/**
 * Analyzes a single customer's refund behavior.
 *
 * Steps: locate customer, collect related records, evaluate shared
 * IP/device relationships and individual signals, then aggregate the total
 * score and risk level into an explainable result.
 *
 * Returns null when the customer does not exist in the dataset.
 */
function analyzeCustomerRisk(customerId, dataset, context) {
  const base = collectCustomerRecords(customerId, dataset);
  if (!base.customer) return null;

  const ctx = context || buildContext(dataset);
  const signals = evaluateSignals(base, ctx);
  const score = clamp(
    signals.reduce((sum, s) => sum + s.contribution, 0),
    0,
    config.maxScore
  );
  const level = riskLevel(score, config);

  return { customerId, score, level, signals };
}

/**
 * Analyzes every customer in the dataset and returns results sorted by
 * descending score (ties broken by ascending customerId), so the order is
 * fully deterministic.
 */
function analyzeAllCustomers(dataset) {
  const ctx = buildContext(dataset);
  const results = dataset.customers.map((c) => analyzeCustomerRisk(c.customerId, dataset, ctx));
  results.sort(compareByScoreDesc);
  return results;
}

/**
 * Dataset summary used by consumers (e.g. run.js) for distribution reports.
 */
function summarize(results) {
  const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
  let sum = 0;
  for (const r of results) {
    distribution[r.level] = (distribution[r.level] || 0) + 1;
    sum += r.score;
  }
  const average = results.length ? sum / results.length : 0;
  return { count: results.length, average, distribution };
}

module.exports = {
  analyzeCustomerRisk,
  analyzeAllCustomers,
  buildContext,
  evaluateSignals,
  summarize,
  config,
};