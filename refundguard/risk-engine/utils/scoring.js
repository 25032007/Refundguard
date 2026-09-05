/**
 * Deterministic scoring utilities.
 *
 * `classify` maps a numeric metric to a severity tier using config thresholds.
 * Tiers are recorded as { from, level, contribution } and must be sorted by
 * `from` descending; they are sorted defensively so behavior is stable.
 */

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) throw new Error(`Cannot clamp non-finite value ${value}`);
  return Math.min(max, Math.max(min, value));
}

function classify(value, tiers) {
  const sorted = [...tiers].sort((a, b) => b.from - a.from);
  for (const tier of sorted) {
    if (value >= tier.from) return tier.level;
  }
  return null;
}

function contributionFor(cfg, severity) {
  if (!severity) return 0;
  const tier = cfg.tiers.find((t) => t.level === severity);
  return tier ? tier.contribution : 0;
}

function riskLevel(score, config) {
  for (const tier of config.riskLevels) {
    if (score >= tier.from) return tier.level;
  }
  return 'low';
}

/**
 * Deterministic sort used for all engine ordering:
 * numeric score descending, then identifier ascending.
 */
function compareByScoreDesc(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.customerId < b.customerId) return -1;
  if (a.customerId > b.customerId) return 1;
  return 0;
}

module.exports = { clamp, classify, contributionFor, riskLevel, compareByScoreDesc };