/**
 * Signal 3 — Refund Velocity.
 *
 * Flags concentrated refund behavior: how many refunds the customer requested
 * inside a recent rolling window. Customers who batch many refunds in a short
 * period score higher than those who spread the same number of refunds over
 * months. The observation window is configurable (config.refundVelocity.windowDays).
 *
 * The analysis reference time (`ctx.now`) is the latest refund request seen in
 * the whole dataset, so the result is fully deterministic and does not depend
 * on the system clock.
 */

const config = require('../config');
const { toMs } = require('../utils/dates');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base, ctx) {
  const cfg = config.refundVelocity;
  const windowDays = cfg.windowDays;
  const cutoffMs = toMs(ctx.now) - windowDays * 86400000;

  const recentRefundCount = base.refunds.filter((r) => toMs(r.requestedAt) >= cutoffMs).length;
  const severity = classify(recentRefundCount, cfg.tiers);
  if (!severity) return null;

  return {
    type: 'refund_velocity',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `Customer made ${recentRefundCount} refund request${recentRefundCount === 1 ? '' : 's'} within the last ${windowDays} days.`,
    evidence: { recentRefundCount, windowDays },
  };
}

module.exports = { evaluate };