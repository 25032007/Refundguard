/**
 * Signal 1 — Refund Frequency.
 *
 * Flags customers with an unusually high number of refunds in the observed
 * period. Pure count; temporal concentration is handled by refundVelocity.
 */

const config = require('../config');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base) {
  const cfg = config.refundFrequency;
  const refundCount = base.refunds.length;
  const severity = classify(refundCount, cfg.tiers);
  if (!severity) return null;

  return {
    type: 'refund_frequency',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `Customer has ${refundCount} refund${refundCount === 1 ? '' : 's'} in the observed period.`,
    evidence: { refundCount },
  };
}

module.exports = { evaluate };