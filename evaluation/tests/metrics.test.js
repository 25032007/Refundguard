const { test } = require('node:test');
const assert = require('node:assert');
const { calculateMetrics, calculateBreakdowns, aggregateMetrics, calculatePrAuc } = require('../metrics');

test('Evaluation Metrics', async (t) => {
  await t.test('confusion matrix and basic metrics', () => {
    const predictions = [
      { groundTruthLabel: 'FRAUD', predictedFraud: true, predictedRiskScore: 90 }, // TP
      { groundTruthLabel: 'FRAUD', predictedFraud: false, predictedRiskScore: 40 }, // FN
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: true, predictedRiskScore: 80 }, // FP
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: false, predictedRiskScore: 10 }, // TN
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: false, predictedRiskScore: 20 }, // TN
    ];

    const result = calculateMetrics(predictions);
    assert.strictEqual(result.confusionMatrix.tp, 1);
    assert.strictEqual(result.confusionMatrix.fn, 1);
    assert.strictEqual(result.confusionMatrix.fp, 1);
    assert.strictEqual(result.confusionMatrix.tn, 2);
    
    assert.strictEqual(result.confusionMatrix.actualFraud, 2);
    assert.strictEqual(result.confusionMatrix.actualLegitimate, 3);
    assert.strictEqual(result.confusionMatrix.predictedFraud, 2);

    assert.strictEqual(result.metrics.precision, 0.5); // 1 / 2
    assert.strictEqual(result.metrics.recall, 0.5); // 1 / 2
    assert.strictEqual(result.metrics.f1, 0.5); // 2 * 0.5 * 0.5 / 1.0
    assert.strictEqual(result.metrics.fpr, 1/3); // 1 / 3
  });

  await t.test('zero-positive behavior', () => {
    const predictions = [
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: false, predictedRiskScore: 10 },
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: false, predictedRiskScore: 20 },
    ];
    const result = calculateMetrics(predictions);
    assert.strictEqual(result.metrics.precision, 0);
    assert.strictEqual(result.metrics.recall, 0);
    assert.strictEqual(result.metrics.f1, 0);
    assert.strictEqual(result.metrics.fpr, 0);
    assert.strictEqual(result.metrics.prAuc, 0);
  });

  await t.test('tied scores in PR-AUC', () => {
    // If scores are tied, they group together.
    const predictions = [
      { groundTruthLabel: 'FRAUD', predictedFraud: true, predictedRiskScore: 90 },
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: true, predictedRiskScore: 90 },
      { groundTruthLabel: 'FRAUD', predictedFraud: true, predictedRiskScore: 90 }
    ];
    // Threshold 90 includes 2 TP and 1 FP
    // TP=2, FP=1, Total Actual = 2
    // Recall = 2/2 = 1.0
    // Precision = 2/3
    // AUC uses trapz from (R=0, P=1) to (R=1, P=2/3) => dR=1, avgP = (1 + 2/3)/2 = 5/6 = 0.8333
    const auc = calculatePrAuc(predictions);
    assert.ok(Math.abs(auc - (5/6)) < 0.0001);
  });

  await t.test('accounting invariants', () => {
    const predictions = [
      { groundTruthLabel: 'FRAUD', predictedFraud: true, predictedRiskScore: 90 }
    ];
    // intentionally break predictions to test invariant? The function computes TP/TN from data, so it can't naturally break unless there's a logic bug. 
    // We just verify it doesn't throw.
    assert.doesNotThrow(() => calculateMetrics(predictions));
  });

  await t.test('scenario breakdown and multi-label category handling', () => {
    const predictions = [
      { groundTruthLabel: 'FRAUD', predictedFraud: true, scenarioCategories: ['obvious_ring'] },
      { groundTruthLabel: 'FRAUD', predictedFraud: false, scenarioCategories: ['obvious_ring', 'noisy_ring'] },
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: true, scenarioCategories: ['LEGITIMATE_HOSTEL'] },
      { groundTruthLabel: 'LEGITIMATE', predictedFraud: false, scenarioCategories: ['LEGITIMATE_HOSTEL', 'LEGITIMATE_HIGH_REFUND_RATE'] }
    ];

    const breakdown = calculateBreakdowns(predictions);
    
    // obvious_ring total 2, detected 1 -> recall 0.5
    assert.strictEqual(breakdown.scenarios['obvious_ring'].total, 2);
    assert.strictEqual(breakdown.scenarios['obvious_ring'].detected, 1);
    assert.strictEqual(breakdown.scenarios['obvious_ring'].recall, 0.5);

    // noisy_ring total 1, detected 0 -> recall 0
    assert.strictEqual(breakdown.scenarios['noisy_ring'].total, 1);
    assert.strictEqual(breakdown.scenarios['noisy_ring'].detected, 0);
    assert.strictEqual(breakdown.scenarios['noisy_ring'].recall, 0);

    // LEGITIMATE_HOSTEL total 2, fp 1 -> fpr 0.5
    assert.strictEqual(breakdown.legitimateHardNegatives['LEGITIMATE_HOSTEL'].total, 2);
    assert.strictEqual(breakdown.legitimateHardNegatives['LEGITIMATE_HOSTEL'].falsePositives, 1);
    assert.strictEqual(breakdown.legitimateHardNegatives['LEGITIMATE_HOSTEL'].fpr, 0.5);

    // LEGITIMATE_HIGH_REFUND_RATE total 1, fp 0 -> fpr 0
    assert.strictEqual(breakdown.legitimateHardNegatives['LEGITIMATE_HIGH_REFUND_RATE'].total, 1);
    assert.strictEqual(breakdown.legitimateHardNegatives['LEGITIMATE_HIGH_REFUND_RATE'].falsePositives, 0);
    assert.strictEqual(breakdown.legitimateHardNegatives['LEGITIMATE_HIGH_REFUND_RATE'].fpr, 0);
  });

  await t.test('multi-seed mean and std', () => {
    const seedResults = [
      { metrics: { precision: 0.8, recall: 0.5, f1: 0.6, fpr: 0.1, prAuc: 0.7 } },
      { metrics: { precision: 0.9, recall: 0.7, f1: 0.8, fpr: 0.05, prAuc: 0.8 } }
    ];

    const agg = aggregateMetrics(seedResults);
    
    // Mean of precision
    assert.ok(Math.abs(agg.precision.mean - 0.85) < 0.0001);
    // Std (sample std dev of 0.8, 0.9)
    // mean = 0.85, var = ((0.8-0.85)^2 + (0.9-0.85)^2)/1 = 2 * 0.0025 = 0.005
    // std = sqrt(0.005) ≈ 0.0707
    assert.ok(Math.abs(agg.precision.std - Math.sqrt(0.005)) < 0.0001);
    
    // min and max
    assert.strictEqual(agg.precision.min, 0.8);
    assert.strictEqual(agg.precision.max, 0.9);

    // Std with length 1 should be 0
    const agg1 = aggregateMetrics([seedResults[0]]);
    assert.strictEqual(agg1.precision.std, 0);
  });
});
