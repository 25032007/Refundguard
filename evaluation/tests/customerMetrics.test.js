/**
 * Phase 3 customer-level metric tests (PR-AUC, family recall, group FPR)
 * on hand-made feature rows. No UCI needed.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { makeTinyDataset } = require('./fixtures/phase3');
const {
  buildPredictions,
  metricsForCondition,
  aggregateCondition,
  chooseThresholdByF1,
  LEGIT_GROUPS
} = require('../customerMetrics');

const { groundTruth } = makeTinyDataset();
const thresholds = { nlp: 5, ringScore: 30 };

// Features consistent with tiny dataset: 3 obvious_ring fraud (high risk, ring), 3 noisy (nlp), 2 legit.
const features = [
  { customerId: 'bg1', riskScore: 10, riskLevel: 'low', nlpContribution: 0, ring: null },
  { customerId: 'bg2', riskScore: 15, riskLevel: 'low', nlpContribution: 1, ring: null },
  { customerId: 'a1', riskScore: 95, riskLevel: 'critical', nlpContribution: 12, ring: { ringId: 'ring_a', score: 90, severity: 'critical' } },
  { customerId: 'a2', riskScore: 92, riskLevel: 'critical', nlpContribution: 11, ring: { ringId: 'ring_a', score: 90, severity: 'critical' } },
  { customerId: 'a3', riskScore: 90, riskLevel: 'critical', nlpContribution: 10, ring: { ringId: 'ring_a', score: 90, severity: 'critical' } },
  { customerId: 'b1', riskScore: 30, riskLevel: 'medium', nlpContribution: 14, ring: null },
  { customerId: 'b2', riskScore: 35, riskLevel: 'medium', nlpContribution: 15, ring: null },
  { customerId: 'b3', riskScore: 25, riskLevel: 'medium', nlpContribution: 13, ring: null }
];

test('LEGIT_GROUPS are six distinct known groups', () => {
  assert.strictEqual(LEGIT_GROUPS.length, 6);
  assert.strictEqual(new Set(LEGIT_GROUPS).size, LEGIT_GROUPS.length);
  assert.ok(LEGIT_GROUPS.includes('LEGITIMATE_HOUSEHOLD'));
  assert.ok(LEGIT_GROUPS.includes('LEGITIMATE_NORMAL'));
  assert.ok(LEGIT_GROUPS.includes('LEGITIMATE_HIGH_REFUND_RATE'));
});

test('buildPredictions honors condition-specific thresholds', () => {
  const preds = buildPredictions(features, groundTruth, 'combined', thresholds);
  assert.strictEqual(preds.length, features.length);
  const flagged = preds.filter(p => p.predictedFraud).length;
  assert.strictEqual(flagged, 6);
});

test('metricsForCondition reports prevalence explicitly and valid metrics', () => {
  const m = metricsForCondition(features, { customers: groundTruth.customers }, 'combined', thresholds);
  assert.strictEqual(m.prevalence, 6 / 8);
  assert.ok(Number.isFinite(m.metrics.precision));
  assert.ok(Number.isFinite(m.metrics.recall));
  assert.ok(Number.isFinite(m.metrics.f1));
  assert.ok(m.metrics.f1 > 0.5, `expected high combined F1, got ${m.metrics.f1}`);
  assert.strictEqual(typeof m.tp, 'undefined'); // pooled counts live in aggregateCondition
});

test('family recall covers the injected families', () => {
  const m = metricsForCondition(features, { customers: groundTruth.customers }, 'combined', thresholds);
  assert.deepStrictEqual(Object.keys(m.familyRecalls || {}).sort(), ['noisy_ring', 'obvious_ring']);
  assert.strictEqual(m.familyRecalls.obvious_ring.recall, 1);
  assert.strictEqual(m.familyRecalls.noisy_ring.recall, 1);
});

test('group FPR distinguishes household vs normal background', () => {
  const m = metricsForCondition(features, { customers: groundTruth.customers }, 'combined', thresholds);
  assert.strictEqual(m.groupFpr.LEGITIMATE_NORMAL.fpr, 0);
  assert.strictEqual(m.groupFpr.LEGITIMATE_HOUSEHOLD.fpr, 0);
});

test('aggregateCondition pools per-seed summaries and recalls', () => {
  const s1 = metricsForCondition(features, { customers: groundTruth.customers }, 'combined', thresholds);
  const s2 = metricsForCondition(features, { customers: groundTruth.customers }, 'combined', thresholds);
  const agg = aggregateCondition([s1, s2], 'combined');
  assert.ok(Number.isFinite(agg.summaries.f1.mean));
  assert.ok(agg.summaries.f1.mean > 0.5);
  assert.strictEqual(agg.familyRecalls.obvious_ring.detected, 6);
  assert.strictEqual(agg.groupFpr.LEGITIMATE_NORMAL.falsePositives, 0);
});

test('chooseThresholdByF1 picks threshold maximizing F1 over candidate batches', () => {
  const scoreFn = (v) => {
    if (v === 0) return 7 / (7 + 20 + 0) * 2 * (7) / (2 * 7 + 20); // terrible
    if (v === 5) return 0.9231; // near-perfect F1
    return 0.5;
  };
  const chosen = chooseThresholdByF1([0, 5, 10], scoreFn);
  assert.strictEqual(chosen.value, 5);
  assert.ok(chosen.f1 > 0.8);
});