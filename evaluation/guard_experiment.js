/**
 * Phase 2E: Refund-Rate Activity Guard Experiment
 *
 * Investigates whether requiring a minimum completed-transaction count before
 * the refundRate signal fires reduces false positives on LEGITIMATE_HIGH_REFUND_RATE
 * customers without unacceptable fraud recall loss.
 *
 * TUNING SEEDS:  1, 2, 3  (used for candidate selection only)
 * HELD-OUT SEEDS: 4, 5    (untouched until final evaluation)
 *
 * Guard candidates evaluated: minCompletedTransactions in { 1 (baseline), 2, 3, 4 }
 * Default (1) = current behavior. Guard activates above 1.
 *
 * Selection criterion: Highest F1 on tuning seeds while LEGITIMATE_HIGH_REFUND_RATE
 * FPR is lower than baseline. Reject any candidate that reduces fraud recall by > 5 pp.
 */

const { execSync } = require('child_process');
const path = require('path');
const riskEngineConfig = require('../risk-engine/config');
const riskEngine = require('../risk-engine/index');
const { calculateMetrics, calculateBreakdowns, aggregateMetrics } = require('./metrics');
const fs = require('fs');

const GENERATED_DIR = path.join(__dirname, '..', 'data', 'generated', 'uci');

const TUNING_SEEDS  = [1, 2, 3];
const HELD_OUT_SEEDS = [4, 5];
const GUARD_CANDIDATES = [1, 2, 3, 4, 5, 8, 10]; // 1 = baseline

function isFraudPrediction(level) { return level === 'high' || level === 'critical'; }

function loadJson(filename) {
  const p = path.join(GENERATED_DIR, filename);
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function generateBenchmark(seed) {
  execSync(`node data/adapters/onlineRetail.js --seed ${seed}`, {
    cwd: path.join(__dirname, '..'), stdio: 'ignore'
  });
}

/**
 * Evaluate with a specific minCompletedTransactions value.
 * Mutates config temporarily, restores immediately after.
 * Config mutation is single-threaded (Node.js) so safe in sequential execution.
 */
function evaluateWithGuard(seed, minCompleted) {
  const original = riskEngineConfig.refundRate.minCompletedTransactions;
  riskEngineConfig.refundRate.minCompletedTransactions = minCompleted;

  try {
    const dataset = {
      customers: loadJson('customers.json'),
      transactions: loadJson('transactions.json'),
      refunds: loadJson('refunds.json'),
      complaints: loadJson('complaints.json'),
      devices: loadJson('devices.json')
    };
    const groundTruth = loadJson('ground-truth.json');
    const gtMap = groundTruth.customers || {};

    const riskResults = riskEngine.analyzeAllCustomers(dataset);
    const predictions = [];
    let legit = 0, fraud = 0;

    for (const res of riskResults) {
      const gt = gtMap[res.customerId];
      if (!gt) throw new Error(`Missing ground truth for ${res.customerId}`);
      const groundTruthLabel = gt.label;
      const scenarioCategories = gt.categories || [];
      if (groundTruthLabel === 'LEGITIMATE') legit++;
      else if (groundTruthLabel === 'FRAUD') fraud++;
      predictions.push({
        customerId: res.customerId,
        predictedRiskScore: res.score,
        predictedRiskLevel: res.level,
        predictedFraud: isFraudPrediction(res.level),
        groundTruthLabel,
        scenarioCategories
      });
    }

    const metricsResult = calculateMetrics(predictions);
    const breakdowns = calculateBreakdowns(predictions);

    return {
      seed,
      minCompleted,
      counts: { customerCount: dataset.customers.length, fraudCustomerCount: fraud, legitimateCustomerCount: legit },
      confusionMatrix: metricsResult.confusionMatrix,
      metrics: metricsResult.metrics,
      scenarios: breakdowns.scenarios,
      legitimateHardNegatives: breakdowns.legitimateHardNegatives
    };
  } finally {
    // Always restore — even if evaluate throws
    riskEngineConfig.refundRate.minCompletedTransactions = original;
  }
}

function calculateDeltas(ablatedMeans, baselineMeans) {
  return Object.fromEntries(
    ['precision','recall','f1','fpr','prAuc'].map(k => [k, ablatedMeans[k] - baselineMeans[k]])
  );
}

function extractMeans(agg) {
  return { precision: agg.precision.mean, recall: agg.recall.mean,
           f1: agg.f1.mean, fpr: agg.fpr.mean, prAuc: agg.prAuc.mean };
}

function runSeeds(seeds, minCompleted, generate = true) {
  const perSeed = [];
  for (const seed of seeds) {
    if (generate) generateBenchmark(seed);
    perSeed.push(evaluateWithGuard(seed, minCompleted));
  }
  return { minCompleted, perSeed, aggregate: aggregateMetrics(perSeed) };
}

function meanHardNegFpr(perSeed, category) {
  const fprs = perSeed.map(s => s.legitimateHardNegatives[category]?.fpr ?? 0);
  return fprs.reduce((a,b) => a+b, 0) / fprs.length;
}

function runExperiment(generate = true) {
  // ── TUNING PHASE ─────────────────────────────────────────────────────────
  const tuningResults = {};
  for (const seed of TUNING_SEEDS) {
    if (generate) generateBenchmark(seed);
  }
  for (const minC of GUARD_CANDIDATES) {
    const perSeed = [];
    for (const seed of TUNING_SEEDS) {
      perSeed.push(evaluateWithGuard(seed, minC));
    }
    tuningResults[minC] = { minCompleted: minC, perSeed, aggregate: aggregateMetrics(perSeed) };
  }

  const baselineTuningMeans = extractMeans(tuningResults[1].aggregate);

  // Evaluate candidates: baseline recall as reference
  const baselineRecall = baselineTuningMeans.recall;
  const MAX_RECALL_LOSS_PP = 0.05; // reject if recall drops more than 5 pp

  const candidateScores = [];
  for (const minC of GUARD_CANDIDATES) {
    if (minC === 1) continue; // baseline itself
    const entry = tuningResults[minC];
    const means = extractMeans(entry.aggregate);
    const deltas = calculateDeltas(means, baselineTuningMeans);
    const highRefundFpr = meanHardNegFpr(entry.perSeed, 'LEGITIMATE_HIGH_REFUND_RATE');
    const baseHighRefundFpr = meanHardNegFpr(tuningResults[1].perSeed, 'LEGITIMATE_HIGH_REFUND_RATE');
    const fprImproved = highRefundFpr < baseHighRefundFpr;
    const recallOk = deltas.recall >= -MAX_RECALL_LOSS_PP;

    candidateScores.push({
      minCompleted: minC,
      f1Mean: means.f1,
      recallMean: means.recall,
      fprMean: means.fpr,
      highRefundFpr,
      baseHighRefundFpr,
      deltas,
      fprImproved,
      recallOk,
      // Selection score: only valid candidates (fprImproved AND recallOk)
      // ranked by F1 improvement
      valid: fprImproved && recallOk,
    });
  }

  // Select best valid candidate; fall back to baseline if none qualifies
  const valid = candidateScores.filter(c => c.valid).sort((a,b) => b.f1Mean - a.f1Mean);
  const selected = valid.length > 0 ? valid[0] : null;
  const selectedMinCompleted = selected ? selected.minCompleted : 1;

  // ── HELD-OUT EVALUATION ───────────────────────────────────────────────────
  for (const seed of HELD_OUT_SEEDS) {
    if (generate) generateBenchmark(seed);
  }
  const heldOutBaseline = [];
  const heldOutGuarded = [];
  for (const seed of HELD_OUT_SEEDS) {
    heldOutBaseline.push(evaluateWithGuard(seed, 1));
    heldOutGuarded.push(evaluateWithGuard(seed, selectedMinCompleted));
  }
  const heldOutBaselineAgg = aggregateMetrics(heldOutBaseline);
  const heldOutGuardedAgg  = aggregateMetrics(heldOutGuarded);
  const heldOutBaselineMeans = extractMeans(heldOutBaselineAgg);
  const heldOutGuardedMeans  = extractMeans(heldOutGuardedAgg);
  const heldOutDeltas = calculateDeltas(heldOutGuardedMeans, heldOutBaselineMeans);

  return {
    tuningSeeds: TUNING_SEEDS,
    heldOutSeeds: HELD_OUT_SEEDS,
    guardCandidates: GUARD_CANDIDATES,
    tuning: {
      results: Object.values(tuningResults).map(r => ({
        minCompleted: r.minCompleted,
        perSeed: r.perSeed,
        aggregate: r.aggregate,
        highRefundFpr: meanHardNegFpr(r.perSeed, 'LEGITIMATE_HIGH_REFUND_RATE'),
        deltaVsBaseline: r.minCompleted === 1 ? null :
          calculateDeltas(extractMeans(r.aggregate), baselineTuningMeans)
      })),
      candidateEvaluation: candidateScores,
      selectedMinCompleted,
      selectionReason: selected
        ? `minCompleted=${selected.minCompleted} is the best valid candidate (fprImproved=${selected.fprImproved}, recallOk=${selected.recallOk}, f1Mean=${(selected.f1Mean*100).toFixed(1)}%).`
        : 'No candidate improved FPR without unacceptable recall loss. Guard remains at default (1 = baseline behavior).',
    },
    heldOut: {
      baseline:  { perSeed: heldOutBaseline,  aggregate: heldOutBaselineAgg,  highRefundFpr: meanHardNegFpr(heldOutBaseline, 'LEGITIMATE_HIGH_REFUND_RATE') },
      guarded:   { perSeed: heldOutGuarded,   aggregate: heldOutGuardedAgg,   highRefundFpr: meanHardNegFpr(heldOutGuarded, 'LEGITIMATE_HIGH_REFUND_RATE') },
      deltaVsBaseline: heldOutDeltas,
      highRefundFprDelta: meanHardNegFpr(heldOutGuarded, 'LEGITIMATE_HIGH_REFUND_RATE') - meanHardNegFpr(heldOutBaseline, 'LEGITIMATE_HIGH_REFUND_RATE'),
    },
    metadata: {
      detectorVersion: '0.1.0',
      guardParameter: 'minCompletedTransactions',
      defaultValue: 1,
      selectedValue: selectedMinCompleted,
      selectionCriterion: 'Highest F1 on tuning seeds while: (a) LEGITIMATE_HIGH_REFUND_RATE FPR < baseline FPR, and (b) recall loss <= 5 pp.',
    }
  };
}

async function main() {
  const result = runExperiment(true);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) { main().catch(console.error); }

module.exports = { runExperiment, evaluateWithGuard, calculateDeltas, TUNING_SEEDS, HELD_OUT_SEEDS, GUARD_CANDIDATES };
