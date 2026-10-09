/**
 * Phase 3 decision layer tests: prediction rules + ring escalation variants.
 * Hand-made feature rows; no UCI / engine dependencies.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
  predict,
  CONDITION_KEYS,
  computeOverallRisk,
  highestLevel,
  normalizeLevel,
  rankingScore,
  NLP_MAX
} = require('../decisions');

const thresholds = { nlp: 5, ringScore: 30 };

function feature(overrides = {}) {
  return {
    riskScore: 0,
    riskLevel: 'low',
    nlpContribution: 0,
    ring: null,
    ...overrides
  };
}

test('risk condition flags high and critical only', () => {
  assert.strictEqual(predict(feature({ riskLevel: 'high' }), 'risk_only', thresholds).predictedFraud, true);
  assert.strictEqual(predict(feature({ riskLevel: 'critical' }), 'risk_only', thresholds).predictedFraud, true);
  assert.strictEqual(predict(feature({ riskLevel: 'medium' }), 'risk_only', thresholds).predictedFraud, false);
  assert.strictEqual(predict(feature({ riskLevel: 'low' }), 'risk_only', thresholds).predictedFraud, false);
});

test('nlp condition uses contribution threshold', () => {
  assert.strictEqual(predict(feature({ nlpContribution: 4 }), 'nlp_only', thresholds).predictedFraud, false);
  assert.strictEqual(predict(feature({ nlpContribution: 5 }), 'nlp_only', thresholds).predictedFraud, true);
  assert.strictEqual(predict(feature({ nlpContribution: 6 }), 'nlp_only', thresholds).predictedFraud, true);
});

test('graph condition flags members of rings scoring >= threshold only', () => {
  assert.strictEqual(predict(feature({ ring: null }), 'graph_only', thresholds).predictedFraud, false);
  assert.strictEqual(predict(feature({ ring: { ringId: 'r1', score: 29, severity: 'medium' } }), 'graph_only', thresholds).predictedFraud, false);
  assert.strictEqual(predict(feature({ ring: { ringId: 'r1', score: 30, severity: 'high' } }), 'graph_only', thresholds).predictedFraud, true);
  assert.strictEqual(predict(feature({ ring: { ringId: 'r1', score: 75, severity: 'critical' } }), 'graph_only', thresholds).predictedFraud, true);
});

test('combined condition ORs all three engines', () => {
  assert.strictEqual(predict(feature({}), 'combined', thresholds).predictedFraud, false);
  assert.strictEqual(predict(feature({ riskLevel: 'critical' }), 'combined', thresholds).predictedFraud, true);
  assert.strictEqual(predict(feature({ nlpContribution: 15 }), 'combined', thresholds).predictedFraud, true);
  assert.strictEqual(predict(feature({ ring: { ringId: 'r1', score: 60, severity: 'high' } }), 'combined', thresholds).predictedFraud, true);
});

test('pair conditions OR their two engines only', () => {
  // risk+graph flags a graph-singleton customer; nlp+graph flags too; risk+graph must not be triggered by NLP alone.
  const graphOnly = feature({ ring: { ringId: 'r', score: 50 } });
  const nlpOnly = feature({ nlpContribution: 12 });
  const riskOnly = feature({ riskLevel: 'high' });

  assert.strictEqual(predict(graphOnly, 'risk_graph', thresholds).predictedFraud, true);
  assert.strictEqual(predict(graphOnly, 'nlp_graph', thresholds).predictedFraud, true);
  assert.strictEqual(predict(graphOnly, 'risk_nlp', thresholds).predictedFraud, false);
  assert.strictEqual(predict(nlpOnly, 'risk_nlp', thresholds).predictedFraud, true);
  assert.strictEqual(predict(nlpOnly, 'risk_graph', thresholds).predictedFraud, false);
  assert.strictEqual(predict(riskOnly, 'nlp_graph', thresholds).predictedFraud, false);
});

test('every condition key is known', () => {
  assert.deepStrictEqual(CONDITION_KEYS, ['risk_only', 'nlp_only', 'graph_only', 'risk_nlp', 'risk_graph', 'nlp_graph', 'combined']);
});

test('rankingScore for combined uses max normalized contribution', () => {
  const f = feature({ riskScore: 100, nlpContribution: 15, ring: { ringId: 'r', score: 12 } });
  assert.strictEqual(rankingScore(f, 'combined'), 100);

  // nlp max 15 normalizes to 100; ringScore is already 0-100 scale from graph engine.
  const f2 = feature({ riskScore: 10, nlpContribution: 15, ring: { ringId: 'r', score: 42 } });
  assert.strictEqual(rankingScore(f2, 'combined'), 100);
  assert.strictEqual(rankingScore(feature({ nlpContribution: 15 }), 'nlp_only'), 100);
});

test('NLP_MAX maps 15 -> 100', () => {
  assert.ok(Math.abs(15 * NLP_MAX - 100) < 1e-9);
});

test('highestLevel and normalizeLevel', () => {
  assert.strictEqual(highestLevel('low', 'critical'), 'CRITICAL');
  assert.strictEqual(highestLevel('high', 'medium'), 'HIGH');
  assert.strictEqual(highestLevel('critical', 'high'), 'CRITICAL');
  assert.strictEqual(normalizeLevel('medium'), 'MEDIUM');
});

test('computeOverallRisk critical_bootstrap forces CRITICAL for members of critical rings', () => {
  assert.strictEqual(computeOverallRisk('low', { severity: 'critical' }, 'critical_bootstrap'), 'CRITICAL');
  assert.strictEqual(computeOverallRisk('high', { severity: 'low' }, 'critical_bootstrap'), 'HIGH');
  assert.strictEqual(computeOverallRisk('low', { severity: 'high' }, 'critical_bootstrap'), 'HIGH');
  assert.strictEqual(computeOverallRisk('critical', null, 'critical_bootstrap'), 'CRITICAL');
});

test('computeOverallRisk no_critical_bootstrap equals critical_bootstrap for critical rings (redundant branch)', () => {
  const cases = [
    ['low', { severity: 'critical' }],
    ['high', { severity: 'critical' }],
    ['low', { severity: 'high' }],
    ['high', { severity: 'medium' }],
    ['critical', { severity: 'medium' }]
  ];
  for (const [risk, ring] of cases) {
    assert.strictEqual(
      computeOverallRisk(risk, ring, 'no_critical_bootstrap'),
      computeOverallRisk(risk, ring, 'critical_bootstrap'),
      `${risk}:${JSON.stringify(ring)} must agree`
    );
  }
});

test('computeOverallRisk no_ring_escalation ignores ring severity', () => {
  assert.strictEqual(computeOverallRisk('low', { severity: 'critical' }, 'no_ring_escalation'), 'LOW');
  assert.strictEqual(computeOverallRisk('high', { severity: 'critical' }, 'no_ring_escalation'), 'HIGH');
  assert.strictEqual(computeOverallRisk('critical', null, 'no_ring_escalation'), 'CRITICAL');
});

test('unknown mode throws', () => {
  assert.throws(() => computeOverallRisk('low', null, 'bogus'));
});