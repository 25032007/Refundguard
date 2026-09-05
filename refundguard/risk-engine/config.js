/**
 * Risk Signal Engine — configuration.
 *
 * Single source of truth for every threshold, contribution, and risk-level
 * tier used by the engine. Magic numbers must not be scattered across signal
 * modules.
 *
 * Tier semantics: `tiers` is a list of { from, level, contribution } sorted by
 * `from` descending. A metric value at or above `from` yields that tier.
 * `max` is the theoretical maximum contribution a signal can produce (used for
 * documentation and tests).
 */

module.exports = {
  refundFrequency: {
    max: 20,
    tiers: [
      { from: 5, level: 'high', contribution: 20 },
      { from: 3, level: 'medium', contribution: 10 },
    ],
  },

  refundRate: {
    max: 20,
    tiers: [
      { from: 0.4, level: 'critical', contribution: 20 },
      { from: 0.2, level: 'high', contribution: 15 },
      { from: 0.1, level: 'medium', contribution: 10 },
    ],
  },

  refundVelocity: {
    max: 15,
    windowDays: 30,
    tiers: [
      { from: 4, level: 'high', contribution: 15 },
      { from: 2, level: 'medium', contribution: 8 },
    ],
  },

  repeatedReason: {
    max: 10,
    minCount: 3,
    tiers: [
      { from: 0.6, level: 'high', contribution: 10 },
      { from: 0.4, level: 'medium', contribution: 5 },
    ],
  },

  sharedIp: {
    max: 20,
    tiers: [
      { from: 4, level: 'high', contribution: 20 },
      { from: 2, level: 'medium', contribution: 10 },
    ],
  },

  sharedDevice: {
    max: 15,
    tiers: [
      { from: 4, level: 'high', contribution: 15 },
      { from: 2, level: 'medium', contribution: 8 },
    ],
  },

  // Risk level thresholds applied to the total score (0-100).
  // 0-24 low, 25-49 medium, 50-74 high, 75-100 critical.
  riskLevels: [
    { from: 75, level: 'critical' },
    { from: 50, level: 'high' },
    { from: 25, level: 'medium' },
    { from: 0, level: 'low' },
  ],

  // Theoretical maximum score (sum of all signal max contributions).
  maxScore: 100,
};