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
  assert.ok(Number.isFinite(result.medianLeadTimeDays));
  assert.ok(result.snapshotCount >= 3);
});

test('leadTimeForRing reports null when the ring never matches a passing snapshot', () => {
  const { dataset, groundTruth } = makeTinyDataset();
  const gtRing = { members: ['never', 'appears'], scenarioId: 's_x', family: 'ghost_ring', memberJoinDates: {} };

  const result = analyzeSeedLeadTime(dataset, groundTruth, { ringScoreThreshold: 30, overlapThreshold: RING_MATCH_OVERLAP });
  // This GT ring will not be present in engine output (no matching customers). We
  // run through leadTimeForRing directly; membership is unknown -> 0 overlap everywhere.
  const snapshot = { time: datasetEndMs(dataset), passingRings: [] };
  const lead = leadTimeForRing(gtRing, [snapshot], { overlapThreshold: RING_MATCH_OVERLAP });
  assert.strictEqual(lead.detected, false);
  assert.strictEqual(lead.leadTimeDays, null);
  // and confirm the real analyzeSeedLeadTime does not list ghost_ring as present.
  assert.ok(!result.perRing.some(r => r.scenarioId === 's_x'));
});