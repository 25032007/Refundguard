/**
 * Signal 2 — Refund Rate.
 *
 * refund rate = refunds / completed transactions.
 *
 * Only `completed` transactions count toward the denominator, per spec.
 * Signals nothing when there are no completed transactions to compare against.
 */

const config = require('../config');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base) {
  const cfg = config.refundRate;
  const refundCount = base.refunds.length;
  const transactionCount = base.transactions.length;
  const completedCount = base.transactions.filter((t) => t.status === 'completed').length;
  if (completedCount === 0) return null;

  const refundRate = refundCount / completedCount;
  const severity = classify(refundRate, cfg.tiers);
  if (!severity) return null;

  const percentage = Math.round(refundRate * 100);
  return {
    type: 'refund_rate',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `Customer's refund rate is ${percentage}% (${refundCount} refunds across ${completedCount} completed transactions).`,
    evidence: { refundCount, completedTransactionCount: completedCount, transactionCount, refundRate },
  };
}

module.exports = { evaluate };