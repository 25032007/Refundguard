/**
 * Phase 3 evaluation statistics.
 *
 * Measurement-only deterministic statistics for multi-seed aggregates:
 * mean, sample standard deviation, and 95% confidence intervals using the
 * Student t distribution for small samples.
 */

const T_QF_95 = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
  26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
  31: 2.040, 32: 2.037, 33: 2.035, 34: 2.032, 35: 2.030,
  36: 2.028, 37: 2.026, 38: 2.024, 39: 2.023, 40: 2.021
};
const T_QF_95_DF_GT_40 = 1.95996;

function tValue(df) {
  if (df <= 0) return NaN;
  if (df <= 40) return T_QF_95[df];
  return T_QF_95_DF_GT_40;
}

function mean(values) {
  if (!values || values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (N-1). Returns 0 for 0 or 1 values. */
function std(values) {
  if (!values || values.length === 0) return NaN;
  if (values.length === 1) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * 95% confidence interval of the sample mean.
 * Returns { mean, std, se, ciLow, ciHigh, n }
 * For n <= 1 the CI is null (not estimable without a spread).
 */
function confidenceInterval95(values) {
  const n = values.length;
  if (n === 0) return { n, mean: NaN, std: NaN, se: NaN, ciLow: null, ciHigh: null };
  const m = mean(values);
  const s = std(values);
  if (n === 1) return { n, mean: m, std: 0, se: NaN, ciLow: null, ciHigh: null };
  const se = s / Math.sqrt(n);
  const t = tValue(n - 1);
  return { n, mean: m, std: s, se, ciLow: m - t * se, ciHigh: m + t * se };
}

/**
 * Aggregates a list of per-seed metric values into mean/std/CI95 summary.
 *
 * @param {Array<number>} values
 * @param {object} [options] { clampUnit: true } clamps ciLow/ciHigh to [0,1]
 *   for ratio metrics (precision/recall/F1/FPR/PR-AUC); the t-interval on a
 *   bounded ratio can otherwise exceed the unit interval on small samples.
 */
function summarize(values, options = {}) {
  const ci = confidenceInterval95(values);
  const clamp = options.clampUnit === true;
  const fix = (v) => clamp && typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : v;
  return {
    n: ci.n,
    mean: fix(ci.mean),
    std: fix(ci.std),
    ciLow: fix(ci.ciLow),
    ciHigh: fix(ci.ciHigh)
  };
}

/** Clamps a metric to [0,1] for display safety (never for math). */
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

module.exports = { mean, std, tValue, confidenceInterval95, summarize, clamp01 };