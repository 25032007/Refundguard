/**
 * Signal 2 — Refund Rate.
 *
 * refund rate = refunds / completed transactions.
 *
 * Only `completed` transactions count toward the denominator, per spec.
 * Signals nothing when there are no completed transactions to compare against.
 *
 * Activity guard (Phase 2E):
 *   config.refundRate.minCompletedTransactions controls the minimum completed-
 *   transaction count before this signal fires. Default = 1 (unchanged from
 *   original behavior). Raise to require more activity evidence. This prevents
 *   customers with very few transactions from triggering an extreme rate.
 */

const config = require('../config');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base) {
  const cfg = config.refundRate;
  const refundCount = base.refunds.length;
  const transactionCount = base.transactions.length;
  const completedCount = base.transactions.filter((t) => t.status === 'completed').length;

  // Guard: require a minimum number of completed transactions.
  // Default minCompletedTransactions = 1 preserves original behavior exactly.
  const minRequired = cfg.minCompletedTransactions ?? 1;
  if (completedCount < minRequired) return null;

  const refundRate = refundCount / completedCount;
  const severity = classify(refundRate, cfg.tiers);
  if (!severity) return null;

  const percentage = Math.round(refundRate * 100);
  return {
    type: 'refund_rate',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `Customer's refund rate is ${percentage}% (${refundCount} refunds across ${completedCount} completed transactions).`,
    evidence: { refundCount, completedTransactionCount: completedCount, transactionCount, refundRate, minCompletedTransactions: minRequired },
  };
}

module.exports = { evaluate };