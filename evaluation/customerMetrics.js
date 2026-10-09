/**
 * Phase 3 customer-level evaluation metrics.
 *
 * Builds a prediction array for a given decision condition and threshold set
 * from the per-customer feature rows, then computes:
 *   - confusion matrix + precision / recall / F1 / FPR / PR-AUC (reusing
 *     metrics.calculateMetrics, which is measurement-only and deterministic)
 *   - fraud prevalence (count/total) ALWAYS printed beside PR-AUC
 *   - per-scenario-family recall (each FRAUD customer's categories carry the
 *     injected family id)
 *   - hard-negative FPR per legitimate group type
 *
 * rankingScore (from decisions.js) is used as the PR-AUC ranking score under
 * each condition; it is documented as an evaluation ranking, not a calibrated
 * probability.
 */

const { calculateMetrics } = require('./metrics');
const { conditionPredicate, rankingScore } = require('./decisions');

const LEGIT_GROUPS = [
  'LEGITIMATE_NORMAL',
  'LEGITIMATE_HOUSEHOLD',
  'LEGITIMATE_OFFICE',
  'LEGITIMATE_HOSTEL',
  'LEGITIMATE_WHOLESALER',
  'LEGITIMATE_HIGH_REFUND_RATE'
];

/**
 * Builds prediction rows for one seed.
 *
 * @param {Array<object>} features  per-customer feature rows (benchmark.computeFeatures)
 * @param {object} groundTruth       ground-truth.json (customers map)
 * @param {string} conditionKey      one of decisions.CONDITION_KEYS
 * @param {object} thresholds        { nlp, ringScore }
 */
function buildPredictions(features, groundTruth, conditionKey, thresholds) {
  const gtMap = groundTruth.customers || {};
  const predicate = conditionPredicate(conditionKey);

  const predictions = [];
  for (const f of features) {
    const gt = gtMap[f.customerId];
    if (!gt) throw new Error(`Missing ground truth for customer ${f.customerId}`);
    const predictedFraud = predicate(f, thresholds);
    predictions.push({
      customerId: f.customerId,
      predictedRiskScore: rankingScore(f, conditionKey),
      predictedFraud,
      groundTruthLabel: gt.label,
      scenarioCategories: gt.categories || []
    });
  }
  return predictions;
}

function metricsForCondition(features, groundTruth, conditionKey, thresholds) {
  const predictions = buildPredictions(features, groundTruth, conditionKey, thresholds);
  const result = calculateMetrics(predictions);
  const total = predictions.length;
  const actualFraud = result.confusionMatrix.actualFraud;
  const prevalence = total === 0 ? 0 : actualFraud / total;

  // Per-family recall (FRAUD subsets).
  const familyIds = new Set();
  for (const g of Object.values(groundTruth.customers || {})) {
    if (g.label === 'FRAUD') for (const c of g.categories || []) familyIds.add(c);
  }
  const familyRecalls = {};
  for (const family of [...familyIds].sort()) {
    const subset = predictions.filter(p => p.groundTruthLabel === 'FRAUD' && p.scenarioCategories.includes(family));
    const detected = subset.filter(p => p.predictedFraud).length;
    familyRecalls[family] = { total: subset.length, detected, recall: subset.length === 0 ? 0 : detected / subset.length };
  }

  // Hard-negative FPR per legit group.
  const groupFpr = {};
  for (const group of LEGIT_GROUPS) {
    const subset = predictions.filter(p => p.groundTruthLabel === 'LEGITIMATE' && p.scenarioCategories.includes(group));
    const fp = subset.filter(p => p.predictedFraud).length;
    groupFpr[group] = { total: subset.length, falsePositives: fp, fpr: subset.length === 0 ? 0 : fp / subset.length };
  }

  return {
    condition: conditionKey,
    thresholds,
    metrics: result.metrics,
    confusionMatrix: result.confusionMatrix,
    prevalence,
    familyRecalls,
    groupFpr,
    predictionCount: predictions.length
  };
}

/**
 * Aggregates per-seed metric values for a condition into mean/std/CI95
 * summaries. Keys: precision, recall, f1, fpr, prAuc, prevalence.
 * precision/recall/f1/fpr/prAuc live under each seed's `metrics` object;
 * prevalence is top-level.
 */
function aggregateCondition(seedMetricsList, conditionKey) {
  const { summarize } = require('./stats');
  const keys = ['precision', 'recall', 'f1', 'fpr', 'prAuc', 'prevalence'];
  const valueOf = (s, key) => (key === 'prevalence' ? s.prevalence : (s.metrics && s.metrics[key]));
  const out = { condition: conditionKey, summaries: {} };
  for (const key of keys) {
    out.summaries[key] = summarize(seedMetricsList.map(s => valueOf(s, key)), { clampUnit: true });
  }
  out.familyRecalls = aggregateFamilyRecalls(seedMetricsList);
  out.groupFpr = aggregateGroupFpr(seedMetricsList);
  return out;
}

function aggregateFamilyRecalls(seedMetricsList) {
  const families = new Set();
  for (const s of seedMetricsList) for (const f of Object.keys(s.familyRecalls || {})) families.add(f);
  const out = {};
  for (const f of [...families].sort()) {
    let total = 0, detected = 0;
    for (const s of seedMetricsList) {
      const fr = (s.familyRecalls && s.familyRecalls[f]) || { total: 0, detected: 0 };
      total += fr.total;
      detected += fr.detected;
    }
    out[f] = { total, detected, recall: total === 0 ? 0 : detected / total };
  }
  return out;
}

function aggregateGroupFpr(seedMetricsList) {
  const out = {};
  for (const group of LEGIT_GROUPS) {
    let total = 0, falsePositives = 0;
    for (const s of seedMetricsList) {
      const g = (s.groupFpr && s.groupFpr[group]) || { total: 0, falsePositives: 0 };
      total += g.total;
      falsePositives += g.falsePositives;
    }
    out[group] = { total, falsePositives, fpr: total === 0 ? 0 : falsePositives / total };
  }
  return out;
}

/** Selects the condition threshold that maximizes pooled-dev F1 (ties -> lower value). */
function chooseThresholdByF1(candidateValues, scoreFn) {
  let best = candidateValues[0];
  let bestF1 = -1;
  for (const v of candidateValues) {
    const f1 = scoreFn(v);
    if (f1 > bestF1 + 1e-12) {
      bestF1 = f1;
      best = v;
    }
  }
  return { value: best, f1: bestF1 };
}

module.exports = {
  LEGIT_GROUPS,
  buildPredictions,
  metricsForCondition,
  aggregateCondition,
  aggregateFamilyRecalls,
  aggregateGroupFpr,
  chooseThresholdByF1
};