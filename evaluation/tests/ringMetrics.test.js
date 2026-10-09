/**
 * Phase 3 ring-level metric tests (recovery thresholds, ring FP by group).
 * Uses the hand-made tiny dataset + engineered detected rings.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { makeTinyDataset } = require('./fixtures/phase3');
const {
  gtRingsFromGroundTruth,
  passingRings,
  bestOverlapPerGtRing,
  recoverySummary,
  classifyRings,
  groupOfCustomer,
  aggregateRecovery,
  aggregateFpByGroup,
  PRIMARY_GROUPS
} = require('../ringMetrics');
const { RING_RECOVERY_THRESHOLDS, MIN_RING_MEMBERS } = require('../seeds');

const { groundTruth } = makeTinyDataset();

// Engine-equivalent detected rings:
//  - matches GT ring A exactly {a1,a2,a3} (score 90)
//  - matches GT ring B exactly {b1,b2,b3} (score 80)
//  - an FP ring composed entirely of legitimate background customers {bg1,bg2}
//    (should be classified by majority legit group; bg2 is household)
//  - an FP ring mixing legit + one fraud member
const detectedRings = [
  { ringId: 'ring_a', customerIds: ['a1', 'a2', 'a3'], score: 90, severity: 'critical', memberCount: 3 },
  { ringId: 'ring_b', customerIds: ['b1', 'b2', 'b3'], score: 80, severity: 'high', memberCount: 3 },
  { ringId: 'ring_fp1', customerIds: ['bg1', 'bg2'], score: 50, severity: 'medium', memberCount: 2 },
  { ringId: 'ring_fp2', customerIds: ['bg2', 'x1'], score: 45, severity: 'medium', memberCount: 2 }
];

const GT_MAP = groundTruth.customers;

test('gtRingsFromGroundTruth drops scenarios below MIN_RING_MEMBERS (burst_refund excluded)', () => {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  assert.deepStrictEqual(gtRings.map(r => r.family).sort(), ['noisy_ring', 'obvious_ring']);
});

test('passingRings keeps rings scoring >= threshold', () => {
  const passing = passingRings(detectedRings, 50);
  assert.deepStrictEqual(passing.map(r => r.ringId), ['ring_a', 'ring_b', 'ring_fp1']);
});

test('bestOverlapPerGtRing finds exact and partial overlaps', () => {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  const overlaps = bestOverlapPerGtRing(gtRings, detectedRings);
  const a = overlaps.find(o => o.gtRing.family === 'obvious_ring');
  const b = overlaps.find(o => o.gtRing.family === 'noisy_ring');
  assert.ok(Math.abs(a.bestOverlap - 1) < 1e-9);
  assert.ok(Math.abs(b.bestOverlap - 1) < 1e-9);
});

test('recoverySummary computes rate at 0.3/0.5/0.7', () => {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  const rec = recoverySummary(gtRings, detectedRings, RING_RECOVERY_THRESHOLDS);
  assert.strictEqual(rec.recovery['0.3'].recovered, 2);
  assert.strictEqual(rec.recovery['0.5'].recovered, 2);
  assert.strictEqual(rec.recovery['0.7'].recovered, 2);
  assert.strictEqual(rec.recovery['0.3'].total, 2);
  assert.ok(Math.abs(rec.recovery['0.3'].rate - 1) < 1e-9);
});

test('aggregateRecovery sums over seeds', () => {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  const s1 = recoverySummary(gtRings, detectedRings, RING_RECOVERY_THRESHOLDS);
  const s2 = recoverySummary(gtRings, [detectedRings[0]], RING_RECOVERY_THRESHOLDS);
  const agg = aggregateRecovery([s1, s2], RING_RECOVERY_THRESHOLDS);
  assert.strictEqual(agg['0.3'].recovered, 3);
  assert.strictEqual(agg['0.3'].total, 4);
});

test('groupOfCustomer maps legit primary group', () => {
  assert.strictEqual(groupOfCustomer(GT_MAP, 'bg2'), 'LEGITIMATE_HOUSEHOLD');
  assert.strictEqual(groupOfCustomer(GT_MAP, 'bg1'), 'LEGITIMATE_NORMAL');
  assert.strictEqual(groupOfCustomer(GT_MAP, 'a1'), 'UNKNOWN'); // fraud -> no legit group
});

test('classifyRings: exact matches are not FPs; mixed legit rings are FPs by majority group', () => {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  const cls = classifyRings({
    gtRings,
    detectedRings,
    gtCustomerMap: GT_MAP,
    ringScoreThreshold: 50,
    matchOverlap: 0.5
  });

  assert.strictEqual(cls.matchedCount, 2); // ring_a + ring_b matched
  assert.strictEqual(cls.fpRingCount, 1);  // ring_fp2 below 50 is filtered out; ring_fp1 is FP
  const fp = cls.fpRings.find(r => r.ringId === 'ring_fp1');
  assert.ok(fp.legitMemberCount === 2);
  // Majority legit group: bg1 (NORMAL) and bg2 (HOUSEHOLD) tie -> deterministic first alphabetical
  assert.strictEqual(fp.group, 'LEGITIMATE_HOUSEHOLD');
});

test('classifyRings aggregates fpByGroup deterministically', () => {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  const cls = classifyRings({
    gtRings,
    detectedRings,
    gtCustomerMap: GT_MAP,
    ringScoreThreshold: 30,
    matchOverlap: 0.5
  });
  // with threshold 30, both fp1 and fp2 count as FPs:
  //   fp1 -> household
  //   fp2 -> members bg2 (HOUSEHOLD) + x1 (FRAUD) -> legit majority is 1 household -> household
  assert.strictEqual(cls.fpRingCount, 2);
  assert.strictEqual(cls.fpByGroup.LEGITIMATE_HOUSEHOLD, 2);
});

test('aggregateFpByGroup sums FP counts across seeds', () => {
  const aggregated = aggregateFpByGroup([
    { fpByGroup: { LEGITIMATE_HOUSEHOLD: 2 } },
    { fpByGroup: { LEGITIMATE_OFFICE: 1, LEGITIMATE_HOUSEHOLD: 1 } }
  ]);
  assert.deepStrictEqual(aggregated, {
    LEGITIMATE_HOUSEHOLD: 3,
    LEGITIMATE_OFFICE: 1
  });
});