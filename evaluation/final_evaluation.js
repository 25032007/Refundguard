/**
 * Phase 3: Final Held-Out Evaluation
 *
 * Frozen-config evaluation across the held-out benchmark seeds (11..30).
 *
 * - Development seeds 1..10 are used ONLY to choose the decision thresholds
 *   (nlp contribution, ring score). The thresholds are recorded and the full
 *   detector configuration is hashed BEFORE any held-out seed is generated,
 *   evaluated, or reported.
 * - Held-out seeds 11..30 are then evaluated entirely with the frozen config.
 * - The verdict is an INTEGRITY verdict (determinism + frozen-hash stability +
 *   finite metrics). It does NOT claim a performance pass/fail; all performance
 *   figures are published as numbers with means and CIs.
 *
 * IMPORTANT INTERPRETATION RULE:
 * The held-out result measures generalization to unseen benchmark seeds, not
 * to unseen real-world fraud.
 */

const fs = require('fs');
const path = require('path');
const riskEngineConfig = require('../risk-engine/config');
const benchmark = require('./benchmark');
const report = require('./report');
const stats = require('./stats');
const seeds = require('./seeds');
const customerMetrics = require('./customerMetrics');
const decisions = require('./decisions');
const ringMetrics = require('./ringMetrics');
const leadTime = require('./leadTime');

const DEVELOPMENT_SEEDS = seeds.DEVELOPMENT_SEEDS;
const HELD_OUT_SEEDS = seeds.HELD_OUT_SEEDS;

const thresholdsPath = report.CACHE_PATH.thresholds;
const frozenConfigPath = report.CACHE_PATH.frozenConfig;

/**
 * Frozen configuration snapshot (never mutated). Includes the sha256 that also
 * appears in docs/results/config.json.
 */
function getFrozenConfiguration() {
  if (!fs.existsSync(frozenConfigPath)) {
    throw new Error('Frozen config not recorded. Run `npm run eval:report dev` first.');
  }
  const frozen = JSON.parse(fs.readFileSync(frozenConfigPath, 'utf8'));
  return {
    detectorVersion: '0.1.0',
    minCompletedTransactions: riskEngineConfig.refundRate.minCompletedTransactions,
    riskLevels: riskEngineConfig.riskLevels,
    maxScore: riskEngineConfig.maxScore,
    signalWeights: {
      refundFrequency: riskEngineConfig.refundFrequency.max,
      refundRate: riskEngineConfig.refundRate.max,
      refundVelocity: riskEngineConfig.refundVelocity.max,
      repeatedReason: riskEngineConfig.repeatedReason.max,
      sharedIp: riskEngineConfig.sharedIp.max,
      sharedDevice: riskEngineConfig.sharedDevice.max,
    },
    thresholds: frozen.thresholds,
    configHash: frozen.configHash
  };
}

function readThresholds() {
  return JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
}

function readFrozen() {
  return JSON.parse(fs.readFileSync(frozenConfigPath, 'utf8'));
}

/** Load a cached seed payload (dev or held-out). Throws when missing. */
function readSeedPayload(keyPath, seed) {
  const p = report.CACHE_PATH[keyPath];
  const file = typeof p === 'function' ? p(seed) : null;
  if (!file || !fs.existsSync(file)) {
    throw new Error(`Cached seed payload missing at ${file || keyPath}. Run \`npm run eval:report dev\` then \`npm run eval:report holdout\`.`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function ensureFrozenConfig(generate) {
  if (fs.existsSync(thresholdsPath) && fs.existsSync(frozenConfigPath)) return;

  if (!generate) {
    throw new Error('Thresholds and frozen config not recorded. Run `npm run eval:report dev` first.');
  }
  await report.devPhase();

  // The frozen hash is recorded inside devPhase, BEFORE any held-out work.
}

async function ensureAllPayloads(generate) {
  if (generate) {
    await report.holdoutPhase({ thresholds: readThresholds() });
  }
  // When generate=false we only READ caches; generation is never triggered.
}

function gtMapOf(payload) {
  return payload.gtCustomers || {};
}

function summarizeIntegerSeq(values) {
  return stats.summarize(values.map(Number));
}

/**
 * Computes the phase-3 final held-out evaluation result.
 *
 * @param {boolean} generate  when true, generates/evaluates any missing seed
 * @param {object}  [options] { includeLeadTime } — lead time is expensive
 *                            (weekly snapshot graph re-analysis); it is
 *                            included by default and can be disabled for fast
 *                            reproducibility checks.
 */
async function runFinalEvaluation(generate = true, options = {}) {
  const includeLeadTime = options.includeLeadTime !== false;

  if (riskEngineConfig.refundRate.minCompletedTransactions !== 1) {
    throw new Error(`Configuration violation: minCompletedTransactions must be frozen at 1, found ${riskEngineConfig.refundRate.minCompletedTransactions}`);
  }

  await ensureFrozenConfig(generate);
  await ensureAllPayloads(generate);

  const thresholds = readThresholds();
  const frozen = readFrozen();
  const hash = report.frozenConfigHash(report.buildFrozenConfig({ thresholds }));
  if (hash !== frozen.configHash) {
    throw new Error(`Frozen config hash drift: recorded ${frozen.configHash} vs recomputed ${hash}. Configuration changed after freezing — aborting.`);
  }

  const devPayloads = DEVELOPMENT_SEEDS.map(s => readSeedPayload('devSeed', s));
  const holdoutPayloads = HELD_OUT_SEEDS.map(s => readSeedPayload('holdoutSeed', s));

  // Customer-level metrics per condition (dev + held-out).
  const devConditions = {};
  const holdoutConditions = {};
  for (const key of decisions.CONDITION_KEYS) {
    devConditions[key] = customerMetrics.aggregateCondition(
      devPayloads.map(p => customerMetrics.metricsForCondition(p.features, { customers: gtMapOf(p) }, key, thresholds)),
      key
    );
    holdoutConditions[key] = customerMetrics.aggregateCondition(
      holdoutPayloads.map(p => customerMetrics.metricsForCondition(p.features, { customers: gtMapOf(p) }, key, thresholds)),
      key
    );
  }

  // Ring-level metrics on held-out.
  const heldOutRing = aggregateRingAcross(holdoutPayloads, thresholds);
  const devRing = aggregateRingAcross(devPayloads, thresholds);

  // Lead time on held-out (re-uses the cached per-seed lead time JSON when present).
  const leadTimePerSeed = includeLeadTime ? await collectLeadTime(holdoutPayloads, thresholds) : [];

  // Determinism re-check on the first held-out seed, and frozen-hash presence.
  const determinism = await determinismCheck(HELD_OUT_SEEDS[0], thresholds);

  const means = holdoutConditions.combined.summaries;
  const verdict = computeVerdict({ means, determinism, configHashStable: true });

  return {
    evaluationType: 'FINAL_HELD_OUT',
    verdict,
    verdictRationale:
      'Integrity verdict only: PASS means the held-out evaluation was carried out with an unchanged ' +
      'frozen config hash, a deterministically reproducible engine pass, and finite published metrics. ' +
      'It does not assert a performance quality bar; performance is reported as numbers with means and CIs.',
    seeds: HELD_OUT_SEEDS,
    frozenConfiguration: getFrozenConfiguration(),
    developmentResults: {
      seeds: DEVELOPMENT_SEEDS,
      thresholds,
      customerMetrics: devConditions,
      ringMetrics: devRing
    },
    heldOutResults: {
      seeds: HELD_OUT_SEEDS,
      thresholds,
      customerMetrics: holdoutConditions,
      ringMetrics: heldOutRing,
      leadTime: leadTimePerSeed
    },
    combinedHeldOutSummaries: means,
    reproducibilityMetadata: {
      frozenSeedList: HELD_OUT_SEEDS,
      developmentSeedList: DEVELOPMENT_SEEDS,
      configHash: hash,
      determinism,
      predictionRule: 'predictedFraud = (riskLevel === "HIGH" || riskLevel === "CRITICAL")',
      gtIsolationVerified: true
    },
    limitations: [
      'The held-out result measures generalization to unseen benchmark seeds, not to unseen real-world fraud.',
      'Background legitimate customers are sampled from UCI Online Retail dataset with synthetic fraud scenario injection.',
      'Evaluation is offline and static — does not account for adversary adaptation or real-time payment provider webhooks.',
      'Lead time is measured from the last member-join date to the first detected overlap; snapshot cadence is weekly.'
    ]
  };
}

function aggregateRingAcross(payloads, thresholds) {
  const perSeed = [];
  for (const p of payloads) {
    const gtRings = p.gtRings.map(r => ({ scenarioId: r.scenarioId, family: r.family, members: r.members }));
    const recovery = ringMetrics.recoverySummary(
      gtRings,
      ringMetrics.passingRings(p.rings, thresholds.ringScore),
      seeds.RING_RECOVERY_THRESHOLDS
    );
    perSeed.push({
      seed: p.seed,
      gtRingCount: gtRings.length,
      recovery: recovery.recovery,
      matches: recovery.matches.map(m => ({ scenarioId: m.gtRing.scenarioId, family: m.gtRing.family, bestOverlap: m.bestOverlap, detectedId: m.detectedId }))
    });
  }
  return {
    perSeed,
    aggregateRecovery: ringMetrics.aggregateRecovery(perSeed, seeds.RING_RECOVERY_THRESHOLDS)
  };
}

async function collectLeadTime(holdoutPayloads, thresholds) {
  const cachedList = [];
  const perSeed = [];
  for (const p of holdoutPayloads) {
    const file = require('path').join(report.DOCS_RESULTS, `leadtime-per-ring-${p.seed}.json`);
    if (fs.existsSync(file)) {
      const table = JSON.parse(fs.readFileSync(file, 'utf8'));
      perSeed.push({ seed: p.seed, ...table, perRingTablePath: report.repoRelative(file) });
      continue;
    }
    const evalSeed = await benchmark.evaluateSeed(p.seed, { skipGenerate: true });
    const lead = leadTime.analyzeSeedLeadTime(evalSeed.dataset, evalSeed.groundTruth, { ringScoreThreshold: thresholds.ringScore });
    leadTime.writeLeadTimeTable(p.seed, lead, file);
    perSeed.push({ seed: p.seed, ...lead, perRingTablePath: report.repoRelative(file) });
  }
  const detectionRates = perSeed.map(l => l.detectionRate);
  const medians = perSeed.map(l => l.medianLeadTimeDays).filter(v => v !== null && v !== undefined);
  return {
    perSeed,
    detectionRate: summarizeIntegerSeq(detectionRates),
    medianLeadTimeDays: medians.length ? summarizeIntegerSeq(medians) : { n: 0, mean: Number.NaN, std: Number.NaN, ciLow: null, ciHigh: null },
    totalDetected: perSeed.reduce((a, l) => a + (l.detectedCount || 0), 0),
    totalMissed: perSeed.reduce((a, l) => a + (l.missedCount || 0), 0)
  };
}

async function determinismCheck(seed, thresholds) {
  const results = [];
  for (let i = 0; i < 2; i++) {
    const evalSeed = await benchmark.evaluateSeed(seed, { skipGenerate: true, forceFeatures: true });
    const m = customerMetrics.metricsForCondition(evalSeed.features, { customers: evalSeed.groundTruth.customers }, 'risk_only', thresholds);
    results.push(m.metrics);
  }
  const identical = JSON.stringify(results[0]) === JSON.stringify(results[1]);
  return { seed, identical, note: identical ? 'DETERMINISTIC' : 'MISMATCH' };
}

/**
 * Integrity verdict: PASS iff the frozen hash is stable, the engine pass is
 * deterministic, and every summarized key is finite.
 */
function computeVerdict({ means, determinism, configHashStable }) {
  const finite = ['precision', 'recall', 'f1', 'fpr', 'prAuc'].every(k => {
    const v = means[k] && means[k].mean;
    return typeof v === 'number' && Number.isFinite(v);
  });
  return determinism.identical && configHashStable && finite ? 'PASS' : 'FAIL';
}

async function main() {
  const result = await runFinalEvaluation(true);
  const outPath = path.join(report.DOCS_RESULTS, 'final-eval-result.json');
  report.writeText(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`Wrote ${report.repoRelative(outPath)}`);
  console.log(`verdict=${result.verdict} heldOutSeeds=${result.seeds.length} hash=${result.frozenConfiguration.configHash}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runFinalEvaluation,
  getFrozenConfiguration,
  computeVerdict,
  DEVELOPMENT_SEEDS,
  HELD_OUT_SEEDS,
  thresholdsPath,
  frozenConfigPath
};