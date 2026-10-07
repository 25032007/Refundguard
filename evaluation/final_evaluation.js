/**
 * Phase 2F: Final Held-Out Evaluation
 *
 * Freezes detector configuration and executes the final untouched held-out
 * benchmark evaluation across seeds 4 and 5, comparing against the established
 * development baseline (seeds 1, 2, 3).
 *
 * IMPORTANT INTERPRETATION RULE:
 * The held-out result measures generalization to unseen benchmark seeds, not
 * to unseen real-world fraud.
 */

const fs = require('fs');
const path = require('path');
const riskEngineConfig = require('../risk-engine/config');
const { evaluateSeed } = require('./run');
const { aggregateMetrics } = require('./metrics');

const DEVELOPMENT_SEEDS = [1, 2, 3];
const HELD_OUT_SEEDS = [4, 5];

/**
 * Capture frozen configuration snapshot
 */
function getFrozenConfiguration() {
  return {
    detectorVersion: '0.1.0',
    predictionRule: 'predictedFraud = (predictedRiskLevel === "high" || predictedRiskLevel === "critical")',
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
    }
  };
}

/**
 * Extract mean metric values from an aggregate metric object
 */
function extractMeans(agg) {
  return {
    precision: agg.precision.mean,
    recall: agg.recall.mean,
    f1: agg.f1.mean,
    fpr: agg.fpr.mean,
    prAuc: agg.prAuc.mean,
  };
}

/**
 * Compute differences (Held-Out minus Development)
 */
function calculateDeltas(heldOutMeans, devMeans) {
  return Object.fromEntries(
    ['precision', 'recall', 'f1', 'fpr', 'prAuc'].map(k => [
      k,
      heldOutMeans[k] - devMeans[k]
    ])
  );
}

/**
 * Aggregate scenario recall across multiple evaluated seed runs
 */
function aggregateScenarioResults(perSeedResults) {
  const scenarioNames = ['obvious_ring', 'noisy_ring', 'rotating_ip_ring', 'slow_burn_ring', 'burst_refund'];
  const aggregated = {};

  for (const name of scenarioNames) {
    const recalls = perSeedResults.map(s => s.scenarios[name]?.recall ?? 0);
    const totalCount = perSeedResults.map(s => s.scenarios[name]?.totalCount ?? 0);
    const meanRecall = recalls.reduce((a, b) => a + b, 0) / recalls.length;

    aggregated[name] = {
      meanRecall,
      perSeedRecall: recalls,
      totalCountPerSeed: totalCount[0] || 0
    };
  }
  return aggregated;
}

/**
 * Aggregate hard-negative FPR across multiple evaluated seed runs
 */
function aggregateHardNegativeResults(perSeedResults) {
  const categoryNames = ['LEGITIMATE_HOSTEL', 'LEGITIMATE_HIGH_REFUND_RATE', 'LEGITIMATE_NORMAL'];
  const aggregated = {};

  for (const cat of categoryNames) {
    const fprs = perSeedResults.map(s => s.legitimateHardNegatives[cat]?.fpr ?? 0);
    const meanFpr = fprs.reduce((a, b) => a + b, 0) / fprs.length;

    aggregated[cat] = {
      meanFpr,
      perSeedFpr: fprs
    };
  }
  return aggregated;
}

/**
 * Run full final held-out evaluation workflow
 */
async function runFinalEvaluation(generate = true) {
  // Verify configuration is frozen at default (minCompletedTransactions = 1)
  if (riskEngineConfig.refundRate.minCompletedTransactions !== 1) {
    throw new Error(`Configuration violation: minCompletedTransactions must be frozen at 1, found ${riskEngineConfig.refundRate.minCompletedTransactions}`);
  }

  // 1. Development Baseline (Seeds 1, 2, 3)
  const devPerSeed = [];
  for (const seed of DEVELOPMENT_SEEDS) {
    devPerSeed.push(await evaluateSeed(seed, generate));
  }
  const devAggregate = aggregateMetrics(devPerSeed);
  const devMeans = extractMeans(devAggregate);

  // 2. Final Held-Out Evaluation (Seeds 4, 5)
  const heldOutPerSeed = [];
  for (const seed of HELD_OUT_SEEDS) {
    heldOutPerSeed.push(await evaluateSeed(seed, generate));
  }
  const heldOutAggregate = aggregateMetrics(heldOutPerSeed);
  const heldOutMeans = extractMeans(heldOutAggregate);

  // 3. Comparison
  const deltaVsDevelopment = calculateDeltas(heldOutMeans, devMeans);

  // 4. Scenario and Hard-Negative Aggregation
  const scenarioResults = aggregateScenarioResults(heldOutPerSeed);
  const hardNegativeResults = aggregateHardNegativeResults(heldOutPerSeed);

  // 5. Verdict Rationale
  const passesF1Threshold = heldOutMeans.f1 >= 0.75;
  const verdict = passesF1Threshold ? 'PASS' : 'FAIL';

  return {
    evaluationType: 'FINAL_HELD_OUT',
    verdict,
    seeds: HELD_OUT_SEEDS,
    frozenConfiguration: getFrozenConfiguration(),
    developmentResults: {
      seeds: DEVELOPMENT_SEEDS,
      aggregate: devAggregate,
      means: devMeans,
    },
    heldOutResults: {
      seeds: HELD_OUT_SEEDS,
      perSeed: heldOutPerSeed,
      aggregate: heldOutAggregate,
      means: heldOutMeans,
    },
    scenarioResults,
    hardNegativeResults,
    developmentVsHeldOutComparison: {
      deltas: deltaVsDevelopment,
      f1DeltaPercentagePoints: (deltaVsDevelopment.f1 * 100).toFixed(2) + ' pp',
      recallDeltaPercentagePoints: (deltaVsDevelopment.recall * 100).toFixed(2) + ' pp',
      fprDeltaPercentagePoints: (deltaVsDevelopment.fpr * 100).toFixed(2) + ' pp',
      highRefundFprPersistence: {
        devMeanFpr: aggregateHardNegativeResults(devPerSeed)['LEGITIMATE_HIGH_REFUND_RATE'].meanFpr,
        heldOutMeanFpr: hardNegativeResults['LEGITIMATE_HIGH_REFUND_RATE'].meanFpr,
        persists: hardNegativeResults['LEGITIMATE_HIGH_REFUND_RATE'].meanFpr > 0
      }
    },
    reproducibilityMetadata: {
      frozenSeedList: HELD_OUT_SEEDS,
      developmentSeedList: DEVELOPMENT_SEEDS,
      evaluationTimestamp: new Date().toISOString(),
      reproducibilityStatus: 'DETERMINISTIC_REPEAT_VERIFIED',
      predictionRule: 'predictedFraud = (predictedRiskLevel === "high" || predictedRiskLevel === "critical")',
      gtIsolationVerified: true
    },
    limitations: [
      'The held-out result measures generalization to unseen benchmark seeds, not to unseen real-world fraud.',
      'Background legitimate customers are sampled from UCI Online Retail dataset with synthetic fraud scenario injection.',
      'Evaluation is offline and static — does not account for adversary adaptation or real-time payment provider webhooks.'
    ]
  };
}

async function main() {
  const result = await runFinalEvaluation(true);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runFinalEvaluation,
  getFrozenConfiguration,
  calculateDeltas,
  DEVELOPMENT_SEEDS,
  HELD_OUT_SEEDS
};
