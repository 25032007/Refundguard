/**
 * Tests for fixed scoring utilities: severity classification, contribution
 * lookup, score clamping, and risk-level thresholds. No MongoDB required.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const scoring = require('../utils/scoring');
const config = require('../config');

test('classify returns null below the lowest tier and above-tier beyond the highest', () => {
  const tiers = config.refundFrequency.tiers;
  assert.strictEqual(scoring.classify(0, tiers), null);
  assert.strictEqual(scoring.classify(2, tiers), null);
  assert.strictEqual(scoring.classify(100, tiers), 'high');
});

test('classify uses the highest tier whose lower bound is met', () => {
  const tiers = config.refundFrequency.tiers; // high >=5, medium >=3
  assert.strictEqual(scoring.classify(3, tiers), 'medium');
  assert.strictEqual(scoring.classify(4, tiers), 'medium');
  assert.strictEqual(scoring.classify(5, tiers), 'high');
  assert.strictEqual(scoring.classify(6, tiers), 'high');
});

test('classify handles refund-rate tiers (ratios)', () => {
  const tiers = config.refundRate.tiers; // critical>=0.4, high>=0.2, medium>=0.1
  assert.strictEqual(scoring.classify(0.05, tiers), null);
  assert.strictEqual(scoring.classify(0.1, tiers), 'medium');
  assert.strictEqual(scoring.classify(0.2, tiers), 'high');
  assert.strictEqual(scoring.classify(0.4, tiers), 'critical');
  assert.strictEqual(scoring.classify(2.5, tiers), 'critical');
});

test('classify is robust to out-of-order tiers', () => {
  assert.strictEqual(scoring.classify(8, [{ from: 3, level: 'a' }, { from: 9, level: 'b' }]), 'a');
});

test('contributionFor maps severity to configured contribution', () => {
  assert.strictEqual(scoring.contributionFor(config.sharedIp, 'high'), 20);
  assert.strictEqual(scoring.contributionFor(config.sharedIp, 'medium'), 10);
  assert.strictEqual(scoring.contributionFor(config.refundVelocity, 'high'), 15);
  assert.strictEqual(scoring.contributionFor(config.repeatedReason, 'high'), 10);
  assert.strictEqual(scoring.contributionFor(config.sharedDevice, 'medium'), 8);
  assert.strictEqual(scoring.contributionFor(config.refundRate, 'critical'), 20);
});

test('clamp clamps to 0..100 by default', () => {
  assert.strictEqual(scoring.clamp(50), 50);
  assert.strictEqual(scoring.clamp(0), 0);
  assert.strictEqual(scoring.clamp(100), 100);
  assert.strictEqual(scoring.clamp(-5), 0);
  assert.strictEqual(scoring.clamp(120), 100);
  assert.strictEqual(scoring.clamp(120, 0, 100), 100);
  assert.strictEqual(scoring.clamp(50, 10, 90), 50);
});

test('riskLevel thresholds match the documented bands', () => {
  const level = (score) => scoring.riskLevel(score, config);
  // 0-24 low, 25-49 medium, 50-74 high, 75-100 critical
  assert.strictEqual(level(0), 'low');
  assert.strictEqual(level(24), 'low');
  assert.strictEqual(level(25), 'medium');
  assert.strictEqual(level(49), 'medium');
  assert.strictEqual(level(50), 'high');
  assert.strictEqual(level(74), 'high');
  assert.strictEqual(level(75), 'critical');
  assert.strictEqual(level(100), 'critical');
});

test('sum of signal max contributions equals 100 (score ceiling)', () => {
  const max = Object.entries(config);
  const signalMax = [
    'refundFrequency', 'refundRate', 'refundVelocity',
    'repeatedReason', 'sharedIp', 'sharedDevice',
  ].reduce((sum, key) => sum + config[key].max, 0);
  assert.strictEqual(signalMax, 100);
  assert.strictEqual(config.maxScore, 100);
});