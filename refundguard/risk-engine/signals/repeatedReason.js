/**
 * Signal 4 — Repeated Refund Reason.
 *
 * Flags customers who repeatedly use a single refund reason. Computes the most
 * common reason, its count, and its share of the customer's refunds.
 *
 * A minimum refund count (config.repeatedReason.minCount) is required to avoid
 * noisy signals on tiny samples. Ties for the most common reason resolve to the
 * lexicographically smallest reason for determinism.
 */

const config = require('../config');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base) {
  const cfg = config.repeatedReason;
  const total = base.refunds.length;
  if (total === 0 || total < cfg.minCount) return null;

  const counts = {};
  for (const r of base.refunds) {
    const reason = r.reason === undefined || r.reason === null ? 'unknown' : String(r.reason);
    counts[reason] = (counts[reason] || 0) + 1;
  }

  let reason = Object.keys(counts).sort()[0];
  let count = counts[reason];
  for (const candidate of Object.keys(counts).sort()) {
    if (counts[candidate] > count) {
      reason = candidate;
      count = counts[candidate];
    }
  }

  const percentage = count / total;
  const severity = classify(percentage, cfg.tiers);
  if (!severity) return null;

  return {
    type: 'repeated_refund_reason',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `A single refund reason (${reason}) accounts for ${Math.round(percentage * 100)}% of the customer's ${total} refunds.`,
    evidence: { reason, count, percentage },
  };
}

module.exports = { evaluate };