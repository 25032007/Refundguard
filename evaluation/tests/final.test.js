/**
 * Phase 2F: Final Held-Out Reproducibility Tests
 *
 * Verification suite proving:
 * 1. Held-out seed list is exactly [4, 5]
 * 2. Frozen configuration is used
 * 3. No tuning occurs during final evaluation
 * 4. Repeated held-out evaluation produces identical results
 * 5. Ground truth is consumed only by evaluation, never by detector logic
 * 6. Prediction rule is unchanged
 * 7. Final output structure and metrics are deterministic
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const riskEngineConfig = require('../../risk-engine/config');
const riskEngine = require('../../risk-engine/index');
const { isFraudPrediction, evaluateSeed } = require('../run');
const {
  runFinalEvaluation,
  getFrozenConfiguration,
  DEVELOPMENT_SEEDS,
  HELD_OUT_SEEDS
} = require('../final_evaluation');

// ─── 1. Seed List Integrity ──────────────────────────────────────────────────
test('Phase 2F: Held-out seed list is exactly [4, 5]', () => {
  assert.deepStrictEqual(HELD_OUT_SEEDS, [4, 5]);
  assert.deepStrictEqual(DEVELOPMENT_SEEDS, [1, 2, 3]);
  assert.ok(!HELD_OUT_SEEDS.includes(1), 'Development seed 1 must not be in held-out seeds');
  assert.ok(!HELD_OUT_SEEDS.includes(2), 'Development seed 2 must not be in held-out seeds');
  assert.ok(!HELD_OUT_SEEDS.includes(3), 'Development seed 3 must not be in held-out seeds');
});

// ─── 2. Frozen Configuration ─────────────────────────────────────────────────
test('Phase 2F: Detector configuration is frozen at default values', () => {
  assert.strictEqual(riskEngineConfig.refundRate.minCompletedTransactions, 1);
  assert.strictEqual(riskEngineConfig.maxScore, 100);

  const frozen = getFrozenConfiguration();
  assert.strictEqual(frozen.minCompletedTransactions, 1);
  assert.strictEqual(frozen.detectorVersion, '0.1.0');
  assert.strictEqual(frozen.signalWeights.refundFrequency, 20);
  assert.strictEqual(frozen.signalWeights.refundRate, 20);
  assert.strictEqual(frozen.signalWeights.refundVelocity, 15);
  assert.strictEqual(frozen.signalWeights.repeatedReason, 10);
  assert.strictEqual(frozen.signalWeights.sharedIp, 20);
  assert.strictEqual(frozen.signalWeights.sharedDevice, 15);
});

// ─── 3. No Tuning During Evaluation ──────────────────────────────────────────
test('Phase 2F: Detector configuration is not mutated during final evaluation', async () => {
  const initialConfigStr = JSON.stringify(riskEngineConfig);

  // Run final evaluation with generate=false (uses cached data for speed)
  await runFinalEvaluation(false);

  const postConfigStr = JSON.stringify(riskEngineConfig);
  assert.strictEqual(postConfigStr, initialConfigStr, 'Config must remain untouched after final evaluation');
});

// ─── 4. Deterministic Repeat ─────────────────────────────────────────────────
test('Phase 2F: Repeated evaluation produces identical held-out metrics', async () => {
  const run1 = await evaluateSeed(4, false);
  const run2 = await evaluateSeed(4, false);

  assert.deepStrictEqual(run1.metrics, run2.metrics, 'Metrics on seed 4 must be 100% identical');
  assert.deepStrictEqual(run1.confusionMatrix, run2.confusionMatrix, 'Confusion matrix on seed 4 must be identical');
  assert.deepStrictEqual(run1.scenarios, run2.scenarios, 'Scenario breakdowns must be identical');
});

// ─── 5. Ground Truth Isolation ────────────────────────────────────────────────
test('Phase 2F: Ground truth is isolated from detector input', () => {
  const dir = path.join(__dirname, '..', '..', 'data', 'generated', 'uci');
  const dataset = {
    customers: JSON.parse(fs.readFileSync(path.join(dir, 'customers.json'), 'utf8')),
    transactions: JSON.parse(fs.readFileSync(path.join(dir, 'transactions.json'), 'utf8')),
    refunds: JSON.parse(fs.readFileSync(path.join(dir, 'refunds.json'), 'utf8')),
    complaints: JSON.parse(fs.readFileSync(path.join(dir, 'complaints.json'), 'utf8')),
    devices: JSON.parse(fs.readFileSync(path.join(dir, 'devices.json'), 'utf8')),
  };

  const results = riskEngine.analyzeAllCustomers(dataset);
  for (const r of results) {
    assert.strictEqual('groundTruthLabel' in r, false, 'Risk engine output must not contain groundTruthLabel');
    assert.strictEqual('label' in r, false, 'Risk engine output must not contain label');
    assert.strictEqual('categories' in r, false, 'Risk engine output must not contain scenario categories');
  }
});

// ─── 6. Prediction Rule Unchanged ─────────────────────────────────────────────
test('Phase 2F: Prediction rule correctly maps high and critical risk levels to fraud', () => {
  assert.strictEqual(isFraudPrediction('critical'), true);
  assert.strictEqual(isFraudPrediction('high'), true);
  assert.strictEqual(isFraudPrediction('medium'), false);
  assert.strictEqual(isFraudPrediction('low'), false);
});

// ─── 7. Machine-Readable Schema Integrity ─────────────────────────────────────
test('Phase 2F: Machine-readable final output schema is complete and valid', async () => {
  const res = await runFinalEvaluation(false);

  assert.strictEqual(res.evaluationType, 'FINAL_HELD_OUT');
  assert.strictEqual(res.verdict, 'PASS');
  assert.deepStrictEqual(res.seeds, [4, 5]);

  assert.ok(res.frozenConfiguration, 'frozenConfiguration must exist');
  assert.ok(res.developmentResults, 'developmentResults must exist');
  assert.ok(res.heldOutResults, 'heldOutResults must exist');
  assert.ok(res.scenarioResults, 'scenarioResults must exist');
  assert.ok(res.hardNegativeResults, 'hardNegativeResults must exist');
  assert.ok(res.developmentVsHeldOutComparison, 'developmentVsHeldOutComparison must exist');
  assert.ok(res.reproducibilityMetadata, 'reproducibilityMetadata must exist');
  assert.ok(Array.isArray(res.limitations), 'limitations must be an array');
});
