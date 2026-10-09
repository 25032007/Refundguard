/**
 * Phase 3 final held-out evaluation reproducibility tests.
 *
 * Verifies:
 *  1. Seed plans: development = 1..10, held-out = 11..30 (no overlap).
 *  2. Detector config frozen at default values.
 *  3. No tuning during final evaluation (config JSON untouched).
 *  4. Deterministic repeat of engine feature computation on a held-out seed.
 *  5. Ground-truth isolation from detector engine outputs.
 *  6. Prediction rule unchanged (high/critical => fraud).
 *  7. Final output schema complete; verdict is a self-consistent integrity
 *     result (PASS iff deterministic + frozen-hash stable + finite metrics).
 *
 * Tests that require the phase-3 generation cache (`npm run eval:report`) are
 * skipped when the cache is absent, mirroring the previous UCI-dir gate.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const riskEngineConfig = require('../../risk-engine/config');
const riskEngine = require('../../risk-engine/index');
const { isFraudPrediction } = require('../run');
const seeds = require('../seeds');
const report = require('../report');
const benchmark = require('../benchmark');
const customerMetrics = require('../customerMetrics');
const { makeTinyDataset } = require('./fixtures/phase3');
const {
  runFinalEvaluation,
  getFrozenConfiguration,
  computeVerdict,
  DEVELOPMENT_SEEDS,
  HELD_OUT_SEEDS
} = require('../final_evaluation');

const EVAL_CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'eval', 'cache');
const EVAL_SEED_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'eval');

const hasFrozenCache = () =>
  fs.existsSync(report.CACHE_PATH.thresholds) && fs.existsSync(report.CACHE_PATH.frozenConfig);
const hasSeedDir = (seed) => fs.existsSync(path.join(EVAL_SEED_DIR, `seed-${seed}`, 'metadata.json'));
const hasPayloadCache = (key, seed) => {
  const p = report.CACHE_PATH[key];
  return typeof p === 'function' ? fs.existsSync(p(seed)) : false;
};
const hasAllPayloads = (key, seedList) => hasFrozenCache() && seedList.every(s => hasPayloadCache(key, s));
const hasFullPipelineCache = () =>
  hasAllPayloads('devSeed', DEVELOPMENT_SEEDS) && hasAllPayloads('holdoutSeed', HELD_OUT_SEEDS) && hasSeedDir(11);

// ─── 0. Seed Plan Integrity (always runs) ────────────────────────────────────
test('Phase 3: development seeds are exactly 1..10', () => {
  assert.deepStrictEqual(DEVELOPMENT_SEEDS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepStrictEqual(DEVELOPMENT_SEEDS, seeds.DEVELOPMENT_SEEDS);
});

test('Phase 3: held-out seeds are exactly 11..30 and disjoint from development', () => {
  assert.deepStrictEqual(HELD_OUT_SEEDS, Array.from({ length: 20 }, (_, i) => i + 11));
  assert.deepStrictEqual(HELD_OUT_SEEDS, seeds.HELD_OUT_SEEDS);
  const overlap = DEVELOPMENT_SEEDS.filter(s => HELD_OUT_SEEDS.includes(s));
  assert.deepStrictEqual(overlap, [], 'Development and held-out seeds must not overlap');
});

// ─── 1. Frozen Configuration Defaults (always runs) ──────────────────────────
test('Phase 3: detector configuration is frozen at default values', () => {
  assert.strictEqual(riskEngineConfig.refundRate.minCompletedTransactions, 1);
  assert.strictEqual(riskEngineConfig.maxScore, 100);
});

// ─── 2. No Tuning (requires full pipeline cache) ─────────────────────────────
test('Phase 3: final evaluation does not mutate detector configuration', { skip: !hasFullPipelineCache() }, async () => {
  const initialConfigStr = JSON.stringify(riskEngineConfig);
  await runFinalEvaluation(false, { includeLeadTime: false });
  const postConfigStr = JSON.stringify(riskEngineConfig);
  assert.strictEqual(postConfigStr, initialConfigStr, 'Config must remain untouched after final evaluation');
});

// ─── 3. Deterministic Repeat (requires cached held-out seed) ──────────────────
test('Phase 3: repeated engine feature computation on a held-out seed is identical', { skip: !hasSeedDir(11) }, async () => {
  const run1 = await benchmark.evaluateSeed(11, { skipGenerate: true });
  const run2 = await benchmark.evaluateSeed(11, { skipGenerate: true });
  assert.deepStrictEqual(run1.features, run2.features, 'Features on held-out seed 11 must be 100% identical');
  assert.deepStrictEqual(run1.rings, run2.rings, 'Rings on held-out seed 11 must be identical');
});

// ─── 4. Ground Truth Isolation (hand-made, always runs) ──────────────────────
test('Phase 3: ground truth is isolated from detector input', () => {
  const { dataset } = makeTinyDataset();
  const results = riskEngine.analyzeAllCustomers(dataset);
  for (const r of results) {
    assert.strictEqual('groundTruthLabel' in r, false, 'Risk engine output must not contain groundTruthLabel');
    assert.strictEqual('label' in r, false, 'Risk engine output must not contain label');
    assert.strictEqual('categories' in r, false, 'Risk engine output must not contain scenario categories');
  }
});

// ─── 5. Prediction Rule Unchanged (always runs) ──────────────────────────────
test('Phase 3: prediction rule maps high/critical to fraud on the tiny fixture', () => {
  assert.strictEqual(isFraudPrediction('critical'), true);
  assert.strictEqual(isFraudPrediction('high'), true);
  assert.strictEqual(isFraudPrediction('medium'), false);
  assert.strictEqual(isFraudPrediction('low'), false);
});

// ─── 6. Integrity Verdict Logic (pure, always runs) ──────────────────────────
test('Phase 3: integrity verdict passes iff deterministic + stable hash + finite metrics', () => {
  const finite = { precision: { mean: 0.5 }, recall: { mean: 0.5 }, f1: { mean: 0.5 }, fpr: { mean: 0.1 }, prAuc: { mean: 0.9 } };
  assert.strictEqual(computeVerdict({ means: finite, determinism: { identical: true }, configHashStable: true }), 'PASS');
  assert.strictEqual(computeVerdict({ means: finite, determinism: { identical: false }, configHashStable: true }), 'FAIL');
  assert.strictEqual(computeVerdict({ means: finite, determinism: { identical: true }, configHashStable: false }), 'FAIL');
  const nonFinite = { precision: { mean: Number.NaN }, recall: { mean: 0.5 }, f1: { mean: 0.5 }, fpr: { mean: 0.1 }, prAuc: { mean: 0.9 } };
  assert.strictEqual(computeVerdict({ means: nonFinite, determinism: { identical: true }, configHashStable: true }), 'FAIL');
});

// ─── 7. Machine-Readable Schema Integrity (requires full pipeline cache) ─────
test('Phase 3: final output schema is complete and verdict self-consistent', { skip: !hasFullPipelineCache() }, async () => {
  const res = await runFinalEvaluation(false, { includeLeadTime: false });

  assert.strictEqual(res.evaluationType, 'FINAL_HELD_OUT');
  assert.deepStrictEqual(res.seeds, HELD_OUT_SEEDS);
  assert.ok(['PASS', 'FAIL'].includes(res.verdict), 'verdict must be PASS or FAIL');
  assert.strictEqual(res.frozenConfiguration.configHash, res.reproducibilityMetadata.configHash);

  // Self-consistency: verdict equals computeVerdict over the same inputs.
  const recomputed = computeVerdict({
    means: res.combinedHeldOutSummaries,
    determinism: res.reproducibilityMetadata.determinism,
    configHashStable: true
  });
  assert.strictEqual(res.verdict, recomputed, 'verdict must equal the recomputed integrity verdict');

  assert.ok(res.developmentResults, 'developmentResults must exist');
  assert.ok(res.heldOutResults, 'heldOutResults must exist');
  assert.ok(res.heldOutResults.customerMetrics, 'heldOutResults.customerMetrics must exist');
  assert.ok(res.heldOutResults.ringMetrics, 'heldOutResults.ringMetrics must exist');
  assert.ok(Array.isArray(res.limitations), 'limitations must be an array');

  const f1keys = ['precision', 'recall', 'f1', 'fpr', 'prAuc'];
  for (const k of Object.keys(res.heldOutResults.customerMetrics)) {
    const s = res.heldOutResults.customerMetrics[k].summaries;
    for (const m of f1keys) {
      assert.ok(Number.isFinite(s[m].mean), `combined summary ${k}.${m}.mean must be finite`);
    }
  }
});

// ─── 8. getFrozenConfiguration (requires frozen cache) ───────────────────────
test('Phase 3: frozen config snapshot matches the risk-engine defaults', { skip: !hasFrozenCache() }, () => {
  const frozen = getFrozenConfiguration();
  assert.strictEqual(frozen.minCompletedTransactions, 1);
  assert.strictEqual(frozen.detectorVersion, '0.1.0');
  assert.strictEqual(frozen.signalWeights.refundFrequency, 20);
  assert.strictEqual(frozen.signalWeights.refundRate, 20);
  assert.strictEqual(frozen.signalWeights.refundVelocity, 15);
  assert.strictEqual(frozen.signalWeights.repeatedReason, 10);
  assert.strictEqual(frozen.signalWeights.sharedIp, 20);
  assert.strictEqual(frozen.signalWeights.sharedDevice, 15);
  assert.ok(/^[0-9a-f]{64}$/.test(frozen.configHash), 'configHash must be a sha256 hex digest');
});

// ─── 9. Thresholds frozen before held-out (requires frozen cache) ────────────
test('Phase 3: frozen thresholds are read-only inputs to held-out evaluation', { skip: !hasFrozenCache() }, () => {
  const frozen = JSON.parse(fs.readFileSync(report.CACHE_PATH.frozenConfig, 'utf8'));
  assert.ok(Number.isFinite(frozen.thresholds.nlp));
  assert.ok(Number.isFinite(frozen.thresholds.ringScore));
  assert.ok(Object.keys(frozen.thresholds).sort().join(',') === 'nlp,ringScore');
});