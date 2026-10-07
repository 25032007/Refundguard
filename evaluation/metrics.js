/**
 * Phase 2B: Evaluation Metrics
 * 
 * Measurement-only deterministic evaluation functions.
 */

/**
 * Calculates standard classification metrics from predictions.
 * 
 * Conventions for edge cases:
 * - If precision denominator (TP + FP) is 0, precision = 0.
 * - If recall denominator (TP + FN) is 0, recall = 0.
 * - If F1 denominator (Precision + Recall) is 0, F1 = 0.
 * - If FPR denominator (FP + TN) is 0, FPR = 0.
 * - If actualFraud is 0, PR-AUC = 0.
 */
function calculateMetrics(predictions) {
  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (const p of predictions) {
    const actualFraud = p.groundTruthLabel === 'FRAUD';
    const predictedFraud = p.predictedFraud === true;

    if (actualFraud && predictedFraud) tp++;
    else if (!actualFraud && predictedFraud) fp++;
    else if (!actualFraud && !predictedFraud) tn++;
    else if (actualFraud && !predictedFraud) fn++;
  }

  const actualFraud = tp + fn;
  const actualLegitimate = tn + fp;
  const predictedFraud = tp + fp;

  // Invariant checks
  if (tp + fn !== actualFraud) throw new Error("Invariant broken: TP + FN !== actualFraud");
  if (tn + fp !== actualLegitimate) throw new Error("Invariant broken: TN + FP !== actualLegitimate");
  if (tp + fp !== predictedFraud) throw new Error("Invariant broken: TP + FP !== predictedFraud");

  const precision = (tp + fp) === 0 ? 0 : tp / (tp + fp);
  const recall = (tp + fn) === 0 ? 0 : tp / (tp + fn);
  const f1 = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const fpr = (tn + fp) === 0 ? 0 : fp / (tn + fp);

  const prAuc = calculatePrAuc(predictions);

  return {
    confusionMatrix: {
      tp,
      tn,
      fp,
      fn,
      actualFraud,
      actualLegitimate,
      predictedFraud
    },
    metrics: {
      precision,
      recall,
      f1,
      fpr,
      prAuc
    }
  };
}

/**
 * Calculates PR-AUC using trapezoidal rule.
 * riskScore is used only as a ranking score for PR-AUC; it is not a calibrated probability.
 * Groups by tied scores.
 */
function calculatePrAuc(predictions) {
  const actualFraudTotal = predictions.filter(p => p.groundTruthLabel === 'FRAUD').length;
  if (actualFraudTotal === 0) return 0; // Convention: 0 if no actual positives

  // Group by risk score (descending)
  const scoreGroups = new Map();
  for (const p of predictions) {
    const score = p.predictedRiskScore;
    if (!scoreGroups.has(score)) {
      scoreGroups.set(score, { tp: 0, fp: 0 });
    }
    const group = scoreGroups.get(score);
    if (p.groundTruthLabel === 'FRAUD') group.tp++;
    else group.fp++;
  }

  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);

  let cumulativeTp = 0;
  let cumulativeFp = 0;
  let auc = 0;
  
  let prevRecall = 0;
  let prevPrecision = 1.0; // Start at (R=0, P=1) for AUC

  for (const score of sortedScores) {
    const group = scoreGroups.get(score);
    cumulativeTp += group.tp;
    cumulativeFp += group.fp;

    const recall = cumulativeTp / actualFraudTotal;
    const precision = cumulativeTp / (cumulativeTp + cumulativeFp);

    // Trapezoidal area between previous point and current point
    auc += (recall - prevRecall) * (prevPrecision + precision) / 2;

    prevRecall = recall;
    prevPrecision = precision;
  }

  return auc;
}

/**
 * Calculates scenario and hard-negative specific metrics.
 */
function calculateBreakdowns(predictions) {
  const scenarios = [
    'obvious_ring',
    'noisy_ring',
    'rotating_ip_ring',
    'slow_burn',
    'burst_refund'
  ];

  const hardNegatives = [
    'LEGITIMATE_HOSTEL',
    'LEGITIMATE_HIGH_REFUND_RATE'
  ];

  const breakdown = {
    scenarios: {},
    legitimateHardNegatives: {}
  };

  // For scenarios (actual FRAUD subsets), compute Recall
  // Because they are all actual positives, TPR = Recall = TP / (TP + FN)
  for (const sc of scenarios) {
    const subset = predictions.filter(p => p.groundTruthLabel === 'FRAUD' && p.scenarioCategories.includes(sc));
    const total = subset.length;
    const detected = subset.filter(p => p.predictedFraud).length;
    breakdown.scenarios[sc] = {
      total,
      detected,
      recall: total === 0 ? 0 : detected / total
    };
  }

  // For legitimate hard negatives (actual LEGITIMATE subsets), compute FPR
  // Because they are all actual negatives, FPR = FP / (FP + TN)
  for (const hn of hardNegatives) {
    const subset = predictions.filter(p => p.groundTruthLabel === 'LEGITIMATE' && p.scenarioCategories.includes(hn));
    const total = subset.length;
    const falsePositives = subset.filter(p => p.predictedFraud).length;
    breakdown.legitimateHardNegatives[hn] = {
      total,
      falsePositives,
      fpr: total === 0 ? 0 : falsePositives / total
    };
  }

  return breakdown;
}

/**
 * Aggregates multi-seed results.
 * Standard deviation convention: sample standard deviation (N-1), unless N=1 then 0.
 */
function aggregateMetrics(seedResults) {
  if (!seedResults || seedResults.length === 0) return null;

  const extract = (key) => seedResults.map(r => r.metrics[key]);

  const mean = (arr) => arr.reduce((sum, val) => sum + val, 0) / arr.length;
  
  const std = (arr) => {
    if (arr.length <= 1) return 0;
    const m = mean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  };

  const aggregateKey = (key) => {
    const values = extract(key);
    return {
      mean: mean(values),
      std: std(values)
    };
  };

  return {
    precision: aggregateKey('precision'),
    recall: aggregateKey('recall'),
    f1: aggregateKey('f1'),
    fpr: aggregateKey('fpr'),
    prAuc: aggregateKey('prAuc')
  };
}

module.exports = {
  calculateMetrics,
  calculatePrAuc,
  calculateBreakdowns,
  aggregateMetrics
};
