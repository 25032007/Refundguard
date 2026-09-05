/**
 * Signal 5 — Shared IP.
 *
 * Detects IP addresses used by multiple customer accounts. Uses the complete
 * transaction dataset via the precomputed `ctx.ipCustomers` lookup
 * (ipAddress -> Set(customerId)), then checks whether this customer's IPs
 * overlap with other customers.
 *
 * Evidence exposes customer IDs only — no personal information.
 */

const config = require('../config');
const { classify, contributionFor } = require('../utils/scoring');

function evaluate(base, ctx) {
  const cfg = config.sharedIp;
  const customerId = base.customer.customerId;
  const lookup = ctx.ipCustomers;

  const ips = [...new Set(base.transactions.map((t) => t.ipAddress).filter(Boolean))].sort();

  let best = null; // { ip, linkedCount, linkedCustomers }
  for (const ip of ips) {
    const set = lookup.get(ip);
    if (!set) continue;
    const linkedCustomers = [...set].filter((id) => id !== customerId).sort();
    const linkedCount = linkedCustomers.length;
    if (!best || linkedCount > best.linkedCount) {
      best = { ip, linkedCount, linkedCustomers };
    }
  }

  if (!best || best.linkedCount === 0) return null;

  const severity = classify(best.linkedCount, cfg.tiers);
  if (!severity) return null;

  return {
    type: 'shared_ip',
    severity,
    contribution: contributionFor(cfg, severity),
    description: `Customer shares IP address ${best.ip} with ${best.linkedCount} other customer account${best.linkedCount === 1 ? '' : 's'}.`,
    evidence: {
      sharedIp: best.ip,
      linkedCustomerCount: best.linkedCount,
      linkedCustomers: best.linkedCustomers,
    },
  };
}

module.exports = { evaluate };