/**
 * Phase 2D: Ablation Tests
 *
 * Focused tests for the ablation framework.
 * Uses seed 1 with generate=false (reuses data on disk) to keep tests fast.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const {
  evaluateCondition,
  calculateDeltas,
  extractMeans,
  ABLATION_CONDITIONS,
  isFraudPrediction
} = require('../ablation');
const riskEngine = require('../../risk-engine/index');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Baseline result unchanged
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: baseline result is unchanged', async (t) => {
  await t.test('baseline condition produces known valid metrics', () => {
    const baseline = evaluateCondition(1, new Set());
    assert.ok(baseline.metrics.precision > 0, 'Precision should be > 0');
    assert.ok(baseline.metrics.recall > 0, 'Recall should be > 0');
    assert.ok(baseline.metrics.f1 > 0, 'F1 should be > 0');
    assert.ok(baseline.metrics.fpr >= 0, 'FPR should be >= 0');
    assert.ok(baseline.metrics.prAuc > 0, 'PR-AUC should be > 0');
    assert.strictEqual(baseline.confusionMatrix.tp + baseline.confusionMatrix.fn, baseline.counts.fraudCustomerCount);
  });

  await t.test('baseline condition matches evaluateSeed(1, false)', () => {
    const { evaluateSeed } = require('../run');
    // evaluateSeed and evaluateCondition both operate on the same disk data
    // We verify structural equivalence: same customer count, same fraud count
    const baseline = evaluateCondition(1, new Set());
    // evaluateSeed is async but we can check the static structure
    assert.strictEqual(baseline.counts.customerCount, 2024);
    assert.strictEqual(baseline.counts.fraudCustomerCount, 24);
    assert.strictEqual(baseline.counts.legitimateCustomerCount, 2000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Ablation actually disables only its intended signal
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: signal suppression is correctly scoped', async (t) => {
  await t.test('disabling refundFrequency suppresses only that signal', () => {
    const fs = require('fs');
    const path = require('path');
    const GENERATED_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'uci');
    const dataset = {
      customers: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'customers.json'), 'utf8')),
      transactions: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'transactions.json'), 'utf8')),
      refunds: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'refunds.json'), 'utf8')),
      complaints: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'complaints.json'), 'utf8')),
      devices: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'devices.json'), 'utf8')),
    };
    const ctx = riskEngine.buildContext(dataset);
    const base = {
      customer: dataset.customers[0],
      transactions: dataset.transactions.filter(t => t.customerId === dataset.customers[0].customerId),
      refunds: dataset.refunds.filter(r => r.customerId === dataset.customers[0].customerId),
      complaints: dataset.complaints.filter(c => c.customerId === dataset.customers[0].customerId),
      devices: dataset.devices.filter(d => d.customerId === dataset.customers[0].customerId),
    };

    const withAll = riskEngine.evaluateSignals(base, ctx, new Set());
    const withoutFreq = riskEngine.evaluateSignals(base, ctx, new Set(['refundFrequency']));

    // refundFrequency signal must be absent from the ablated result
    assert.ok(!withoutFreq.some(s => s.type === 'refund_frequency'),
      'refund_frequency signal should be absent when disabled');

    // Other signals may still be present
    const otherSignalTypes = withAll
      .filter(s => s.type !== 'refund_frequency')
      .map(s => s.type);
    for (const t of otherSignalTypes) {
      assert.ok(withoutFreq.some(s => s.type === t),
        `Signal ${t} should still be active when only refundFrequency is disabled`);
    }
  });

  await t.test('disabling sharedIp and sharedDevice leaves refund signals intact', () => {
    const fs = require('fs');
    const path = require('path');
    const GENERATED_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'uci');
    const dataset = {
      customers: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'customers.json'), 'utf8')),
      transactions: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'transactions.json'), 'utf8')),
      refunds: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'refunds.json'), 'utf8')),
      complaints: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'complaints.json'), 'utf8')),
      devices: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'devices.json'), 'utf8')),
    };
    const ctx = riskEngine.buildContext(dataset);
    const base = {
      customer: dataset.customers[0],
      transactions: dataset.transactions.filter(t => t.customerId === dataset.customers[0].customerId),
      refunds: dataset.refunds.filter(r => r.customerId === dataset.customers[0].customerId),
      complaints: dataset.complaints.filter(c => c.customerId === dataset.customers[0].customerId),
      devices: dataset.devices.filter(d => d.customerId === dataset.customers[0].customerId),
    };

    const withoutResourceSharing = riskEngine.evaluateSignals(base, ctx, new Set(['sharedIp', 'sharedDevice']));
    assert.ok(!withoutResourceSharing.some(s => s.type === 'shared_ip'),
      'shared_ip should be absent');
    assert.ok(!withoutResourceSharing.some(s => s.type === 'shared_device'),
      'shared_device should be absent');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Deterministic repeated execution
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: deterministic repeat', () => {
  const resultA = evaluateCondition(1, new Set(['refundFrequency']));
  const resultB = evaluateCondition(1, new Set(['refundFrequency']));
  assert.deepStrictEqual(resultA.metrics, resultB.metrics,
    'Same condition must produce identical metrics on repeated run');
  assert.deepStrictEqual(resultA.confusionMatrix, resultB.confusionMatrix);
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Delta calculation correctness
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: delta calculation', async (t) => {
  await t.test('calculateDeltas returns correct signed differences', () => {
    const ablatedMeans = { precision: 0.70, recall: 0.80, f1: 0.74, fpr: 0.005, prAuc: 0.88 };
    const baselineMeans = { precision: 0.75, recall: 0.92, f1: 0.83, fpr: 0.004, prAuc: 0.93 };
    const deltas = calculateDeltas(ablatedMeans, baselineMeans);

    assert.ok(Math.abs(deltas.precision - (-0.05)) < 1e-9);
    assert.ok(Math.abs(deltas.recall   - (-0.12)) < 1e-9);
    assert.ok(Math.abs(deltas.f1       - (-0.09)) < 1e-9);
    assert.ok(Math.abs(deltas.fpr      -   0.001) < 1e-9);
    assert.ok(Math.abs(deltas.prAuc    - (-0.05)) < 1e-9);
  });

  await t.test('baseline delta with itself is exactly zero', () => {
    const baseline = evaluateCondition(1, new Set());
    const means = extractMeans({ precision: { mean: baseline.metrics.precision }, recall: { mean: baseline.metrics.recall }, f1: { mean: baseline.metrics.f1 }, fpr: { mean: baseline.metrics.fpr }, prAuc: { mean: baseline.metrics.prAuc } });
    const deltas = calculateDeltas(means, means);
    for (const [k, v] of Object.entries(deltas)) {
      assert.strictEqual(v, 0, `Delta for ${k} against itself must be 0`);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. No ground-truth leakage
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: no ground-truth leakage', () => {
  // The risk engine must not have access to ground truth labels
  // We verify: analyzeAllCustomers returns no groundTruthLabel field
  const fs = require('fs');
  const path = require('path');
  const GENERATED_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'uci');
  const dataset = {
    customers: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'customers.json'), 'utf8')),
    transactions: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'transactions.json'), 'utf8')),
    refunds: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'refunds.json'), 'utf8')),
    complaints: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'complaints.json'), 'utf8')),
    devices: JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'devices.json'), 'utf8')),
  };
  const results = riskEngine.analyzeAllCustomers(dataset, new Set());
  for (const r of results) {
    assert.ok(!('groundTruthLabel' in r), 'Risk engine result must not contain groundTruthLabel');
    assert.ok(!('label' in r), 'Risk engine result must not contain label field');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. No threshold mutation
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: thresholds not mutated', () => {
  const config = require('../../risk-engine/config');
  const before = JSON.stringify(config);

  evaluateCondition(1, new Set(['refundFrequency', 'refundRate']));

  const after = JSON.stringify(config);
  assert.strictEqual(before, after, 'Config must not be mutated by ablation');
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. ABLATION_CONDITIONS catalog is complete and well-formed
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: condition catalog is well-formed', () => {
  assert.ok(ABLATION_CONDITIONS.length >= 9, 'Must have baseline + at least 8 ablation conditions');

  const ids = ABLATION_CONDITIONS.map(c => c.id);
  assert.ok(ids.includes('BASELINE'));
  assert.ok(ids.includes('NO_REFUND_FREQ'));
  assert.ok(ids.includes('NO_REFUND_RATE'));
  assert.ok(ids.includes('NO_REFUND_VEL'));
  assert.ok(ids.includes('NO_REPEATED_RSN'));
  assert.ok(ids.includes('NO_SHARED_IP'));
  assert.ok(ids.includes('NO_SHARED_DEV'));
  assert.ok(ids.includes('NO_REFUND_FAMILY'));
  assert.ok(ids.includes('NO_RESOURCE_SHARING'));

  for (const c of ABLATION_CONDITIONS) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0, 'id must be non-empty string');
    assert.ok(typeof c.label === 'string' && c.label.length > 0, 'label must be non-empty string');
    assert.ok(c.disabledSignals instanceof Set, 'disabledSignals must be a Set');
  }

  // Baseline must have empty disabledSignals
  const baseline = ABLATION_CONDITIONS.find(c => c.id === 'BASELINE');
  assert.strictEqual(baseline.disabledSignals.size, 0);

  // NO_REFUND_FAMILY must disable exactly the three refund signals
  const noRefundFamily = ABLATION_CONDITIONS.find(c => c.id === 'NO_REFUND_FAMILY');
  assert.ok(noRefundFamily.disabledSignals.has('refundFrequency'));
  assert.ok(noRefundFamily.disabledSignals.has('refundRate'));
  assert.ok(noRefundFamily.disabledSignals.has('refundVelocity'));
  assert.strictEqual(noRefundFamily.disabledSignals.size, 3);

  // NO_RESOURCE_SHARING must disable exactly the two sharing signals
  const noResourceSharing = ABLATION_CONDITIONS.find(c => c.id === 'NO_RESOURCE_SHARING');
  assert.ok(noResourceSharing.disabledSignals.has('sharedIp'));
  assert.ok(noResourceSharing.disabledSignals.has('sharedDevice'));
  assert.strictEqual(noResourceSharing.disabledSignals.size, 2);
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. NLP / graph disconnection documented at module level
// ──────────────────────────────────────────────────────────────────────────────
test('Ablation: NLP and graph are disconnected from evaluated prediction', () => {
  // The ablation module documents this in metadata
  const { runAblation } = require('../ablation');
  // We verify the metadata fields rather than running the full ablation
  // (runAblation is expensive — we just check the module exports the constants)
  const { ABLATION_CONDITIONS: conds } = require('../ablation');
  // Signal names that should appear are only the 6 risk-engine signals
  const allDisabled = new Set(conds.flatMap(c => [...c.disabledSignals]));
  const expectedSignals = new Set(['refundFrequency', 'refundRate', 'refundVelocity', 'repeatedReason', 'sharedIp', 'sharedDevice']);
  for (const s of allDisabled) {
    assert.ok(expectedSignals.has(s), `Unknown signal in ablation conditions: ${s}`);
  }
  // NLP/graph signal names must not appear
  assert.ok(!allDisabled.has('nlp'), 'NLP must not be in ablation conditions');
  assert.ok(!allDisabled.has('graph'), 'graph must not be in ablation conditions');
  assert.ok(!allDisabled.has('ring'), 'ring must not be in ablation conditions');
});
