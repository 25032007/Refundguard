/**
 * Phase 3 lead-time math tests against the real graph engine on a hand-made
 * dataset (no UCI needed).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { makeTinyDataset } = require('./fixtures/phase3');
const {
  weeklySnapshotTimes,
  minJoinMs,
  maxJoinMs,
  datasetEndMs,
  roundDays,
  analyzeSeedLeadTime,
  leadTimeForRing
} = require('../leadTime');
const { RING_MATCH_OVERLAP } = require('../seeds');

test('weeklySnapshotTimes emits weekly entries from Monday of windowStart', () => {
  const start = new Date('2020-01-15T00:00:00Z').getTime();
  const end = new Date('2020-02-15T00:00:00Z').getTime();
  const times = weeklySnapshotTimes(start, end);
  assert.ok(times.length >= 4, `${times.length} snapshots`);
  for (let i = 1; i < times.length; i++) {
    assert.strictEqual((new Date(times[i]).getTime() - new Date(times[i - 1]).getTime()) / 86400000, 7);
  }
});

test('weeklySnapshotTimes over last snapshot end when window covers fewer days', () => {
  const times = weeklySnapshotTimes(new Date('2020-01-02T00:00:00Z').getTime(), new Date('2020-01-20T00:00:00Z').getTime());
  assert.ok(times.length >= 3);
});

test('min/max/datasetEnd helpers', () => {
  const ring = { members: ['a1', 'a2', 'a3'], memberJoinDates: { a1: Date.UTC(2020, 2, 1), a2: Date.UTC(2020, 2, 10), a3: Date.UTC(2020, 2, 20) } };
  assert.strictEqual(minJoinMs(ring), Date.UTC(2020, 2, 1));
  assert.strictEqual(maxJoinMs(ring), Date.UTC(2020, 2, 20));
  const { dataset } = makeTinyDataset();
  // dataset end >= last event; ensure helper returns a number.
  assert.ok(!Number.isNaN(datasetEndMs(dataset)));
});

test('roundDays rounds to two decimal places', () => {
  assert.strictEqual(roundDays(0.123456), 0.12);
  assert.strictEqual(roundDays(1.555), 1.56);
});

test('analyzeSeedLeadTime detects both rings against engine-generated passing rings', () => {
  const { dataset, groundTruth } = makeTinyDataset();
  const options = { ringScoreThreshold: 30, overlapThreshold: RING_MATCH_OVERLAP };

  const result = analyzeSeedLeadTime(dataset, groundTruth, options);

  // 'obvious_ring' and 'noisy_ring' deliberately have echoed, mid-March refunds.
  assert.strictEqual(result.ringCount, 2);
  assert.strictEqual(result.detectedCount, 2);
  assert.strictEqual(result.missedCount, 0);
  assert.strictEqual(result.detectionRate, 1);
  assert.ok(Number.isFinite(result.medianLeadTimeDays) || result.medianLeadTimeDays === null);
  assert.ok(result.snapshotCount >= 3);
  assert.strictEqual(result.snapshotDates.length, result.snapshotCount);
  assert.ok(result.earlyOrOnTimeCount >= 0 && result.earlyOrOnTimeRate >= 0 && result.earlyOrOnTimeRate <= 1);
  // Two evaluated families, each with median stats present.
  assert.strictEqual(result.perFamily.length, 2);
  for (const fam of result.perFamily) {
    assert.strictEqual(fam.ringCount, 1);
    assert.strictEqual(fam.detectedCount, 1);
    assert.strictEqual(fam.missedCount, 0);
  }
  // Every per-ring row carries both signed quantities.
  for (const r of result.perRing) {
    assert.ok(r.detected);
    assert.strictEqual(r.leadTimeDays, -r.detectionDelayDays);
    assert.ok(r.firstMembershipDate);
    assert.ok(r.finalMembershipDate);
  }
});

test('leadTimeForRing reports null when the ring never matches a passing snapshot', () => {
  const { dataset, groundTruth } = makeTinyDataset();
  const gtRing = { members: ['never', 'appears'], scenarioId: 's_x', family: 'ghost_ring', memberJoinDates: {} };

  const result = analyzeSeedLeadTime(dataset, groundTruth, { ringScoreThreshold: 30, overlapThreshold: RING_MATCH_OVERLAP });
  // This GT ring will not be present in engine output (no matching customers). We
  // run through leadTimeForRing directly; membership is unknown -> 0 overlap everywhere.
  const snapshot = { time: datasetEndMs(dataset), passingRings: [], allRings: [] };
  const lead = leadTimeForRing(gtRing, [snapshot], { overlapThreshold: RING_MATCH_OVERLAP });
  assert.strictEqual(lead.detected, false);
  assert.strictEqual(lead.leadTimeDays, null);
  assert.strictEqual(lead.detectionDelayDays, null);
  // and confirm the real analyzeSeedLeadTime does not list ghost_ring as present.
  assert.ok(!result.perRing.some(r => r.scenarioId === 's_x'));
});

test('leadTimeDays is positive (early) when detection precedes final membership; delay is the negation', () => {
  const base = Date.UTC(2020, 2, 1);
  const gtRing = {
    scenarioId: 's_early',
    family: 'obvious_ring',
    members: ['a1', 'a2', 'a3'],
    memberJoinDates: { a1: base, a2: base + 86400000, a3: base + 3 * 86400000 } // final = base + 3d
  };
  // Detection snapshot happens 2 days before the last member joins -> positive lead time.
  const snapshot = {
    time: new Date(base + 1 * 86400000).toISOString(),
    passingRings: [{ ringId: 'r_early', customerIds: ['a1', 'a2', 'a3'], score: 80 }],
    allRings: [{ ringId: 'r_early', customerIds: ['a1', 'a2', 'a3'], score: 80 }]
  };
  const lead = leadTimeForRing(gtRing, [snapshot], { overlapThreshold: RING_MATCH_OVERLAP, asOfFamilies: ['obvious_ring'] });
  assert.strictEqual(lead.detected, true);
  assert.strictEqual(lead.leadTimeDays, 2);
  assert.strictEqual(lead.detectionDelayDays, -2);
  assert.strictEqual(lead.leadTimeDays, -lead.detectionDelayDays);
  assert.deepStrictEqual(lead.asOfScores, [{ date: snapshot.time, score: 80 }]);
  assert.strictEqual(lead.finalMembershipDate, new Date(base + 3 * 86400000).toISOString());
});

test('detection after final membership yields negative lead time (a delay, not a lead time)', () => {
  const base = Date.UTC(2020, 2, 1);
  const gtRing = {
    scenarioId: 's_late',
    family: 'noisy_ring',
    members: ['a1', 'a2', 'a3'],
    memberJoinDates: { a1: base, a2: base + 86400000, a3: base + 2 * 86400000 } // final = base + 2d
  };
  // Detection snapshot 10 days after the ring fully formed -> late.
  const snapshot = {
    time: new Date(base + 12 * 86400000).toISOString(),
    passingRings: [{ ringId: 'r_late', customerIds: ['a1', 'a2', 'a3'], score: 40 }],
    allRings: [{ ringId: 'r_late', customerIds: ['a1', 'a2', 'a3'], score: 40 }]
  };
  const lead = leadTimeForRing(gtRing, [snapshot], { overlapThreshold: RING_MATCH_OVERLAP, asOfFamilies: ['noisy_ring'] });
  assert.strictEqual(lead.detected, true);
  assert.strictEqual(lead.detectionDelayDays, 10);
  assert.strictEqual(lead.leadTimeDays, -10);
  assert.strictEqual(lead.leadTimeDays, -lead.detectionDelayDays);
});