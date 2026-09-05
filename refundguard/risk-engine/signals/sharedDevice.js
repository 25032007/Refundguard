/**
 * Signal 6 — Shared Device.
 *
 * Detects devices used across multiple customer accounts. IMPORTANT: sharing is
 * derived from transaction.deviceId references (device -> multiple customers),
 * NOT from the Device collection's single-owner `customerId` field. The
 * synthetic dataset deliberately represents shared devices this way.
 *
 * Evidence exposes customer IDs only — no personal information.
 */

const config = require('../config');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base, ctx) {
  const cfg = config.sharedDevice;
  const customerId = base.customer.customerId;
  const lookup = ctx.deviceCustomers;

  const deviceIds = [...new Set(base.transactions.map((t) => t.deviceId).filter(Boolean))].sort();

  let best = null; // { deviceId, linkedCount, linkedCustomers }
  for (const deviceId of deviceIds) {
    const set = lookup.get(deviceId);
    if (!set) continue;
    const linkedCustomers = [...set].filter((id) => id !== customerId).sort();
    const linkedCount = linkedCustomers.length;
    if (!best || linkedCount > best.linkedCount) {
      best = { deviceId, linkedCount, linkedCustomers };
    }
  }

  if (!best || best.linkedCount === 0) return null;

  const severity = classify(best.linkedCount, cfg.tiers);
  if (!severity) return null;

  return {
    type: 'shared_device',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `Device ${best.deviceId} has been used by ${best.linkedCount} other customer account${best.linkedCount === 1 ? '' : 's'}.`,
    evidence: {
      deviceId: best.deviceId,
      linkedCustomerCount: best.linkedCount,
      linkedCustomers: best.linkedCustomers,
    },
  };
}

module.exports = { evaluate };