/**
 * Phase 3 lead-time evaluation (temporal detection).
 *
 * For every ground-truth ring we compute:
 *   - detectionDate:   first weekly snapshot (using analyzeAsOf / filterDatasetAsOf)
 *                      where a detected ring (score >= ringScore threshold) has
 *                      member overlap >= 0.5 with the ground-truth ring.
 *   - finalMembershipDate: max memberJoinDate across ground-truth ring members.
 *   - leadTimeDays:    (detectionDate - finalMembershipDate) / 86400000.
 *                      NEGATIVE lead time means the ring was detected BEFORE it
 *                      fully formed (early detection); positive means late.
 *
 * Detection rate, median lead time (over detected rings only) and missed-ring
 * counts are reported. A per-ring table is serialized to a file for auditing.
 *
 * Determinism: weekly snapshots are fixed ISO timestamps; every ring analysis
 * is a pure function of the as-of dataset.
 */

const { getItemTimestamp, filterDatasetAsOf } = require('../risk-engine/temporal');
const graphEngine = require('../graph/index');
const { gtRingsFromGroundTruth, bestOverlapPerGtRing, passingRings } = require('./ringMetrics');
const { RING_MATCH_OVERLAP } = require('./seeds');

const WEEK_MS = 7 * 86400000;

function roundDays(days) {
  return Math.round(days * 100) / 100;
}

/** Min timestamp (ms) across the members of a ground-truth ring. */
function minJoinMs(gtRing) {
  const joins = (gtRing.members || [])
    .map(m => (gtRing.memberJoinDates && gtRing.memberJoinDates[m]) || null)
    .filter(v => v !== null);
  return joins.length ? Math.min(...joins) : null;
}

/** Max timestamp (ms) across the members of a ground-truth ring. */
function maxJoinMs(gtRing) {
  const joins = (gtRing.members || [])
    .map(m => (gtRing.memberJoinDates && gtRing.memberJoinDates[m]) || null)
    .filter(v => v !== null);
  return joins.length ? Math.max(...joins) : null;
}

/** Max event timestamp in the dataset. */
function datasetEndMs(dataset) {
  let latest = 0;
  for (const key of ['transactions', 'refunds', 'complaints']) {
    for (const item of dataset[key] || []) {
      const ts = getItemTimestamp(item);
      if (ts !== null && ts > latest) latest = ts;
    }
  }
  if (!latest) {
    for (const c of dataset.customers || []) {
      const ts = getItemTimestamp(c);
      if (ts !== null && ts > latest) latest = ts;
    }
  }
  return latest;
}

/**
 * Weekly snapshot timestamps in [startMs, endMs] inclusive of start.
 * Deterministic; each entry is an ISO string.
 */
function weeklySnapshotTimes(startMs, endMs, intervalMs = WEEK_MS) {
  const times = [];
  if (startMs === null || endMs === null) return times;
  for (let t = startMs; t <= endMs; t += intervalMs) {
    times.push(new Date(t).toISOString());
  }
  return times;
}

/**
 * Computes lead time for one ground-truth ring against precomputed snapshot
 * analyses.
 *
 * @param {object} gtRing  ground-truth ring with members and memberJoinDates
 * @param {Array<{time: string, passingRings: Array<object>}>} snapshots
 * @param {object} options { ringScoreThreshold, overlapThreshold }
 * @returns object with detection info (or null when never detected).
 */
function leadTimeForRing(gtRing, snapshots, options) {
  const overlapThreshold = options.overlapThreshold || RING_MATCH_OVERLAP;

  const gtMembers = new Set(gtRing.members);
  let detectionDate = null;
  let detectedRingId = null;
  let bestOverlap = 0;

  for (const snap of snapshots) {
    for (const ring of snap.passingRings) {
      // Note: passingRings are score-filtered at analysis time; re-check for safety.
      const overlap = (() => {
        let inter = 0;
        for (const m of ring.customerIds || []) if (gtMembers.has(m)) inter++;
        const union = gtMembers.size + ring.customerIds.length - inter;
        return union === 0 ? 0 : inter / union;
      })();
      if (overlap > bestOverlap) bestOverlap = overlap;
      if (overlap >= overlapThreshold && detectionDate === null) {
        detectionDate = snap.time;
        detectedRingId = ring.ringId;
      }
    }
    if (detectionDate !== null) break; // first qualifying snapshot
  }

  const finalMembership = maxJoinMs(gtRing);

  if (detectionDate === null) {
    return {
      scenarioId: gtRing.scenarioId,
      family: gtRing.family,
      memberCount: gtRing.members.length,
      detected: false,
      detectionDate: null,
      finalMembershipDate: finalMembership === null ? null : new Date(finalMembership).toISOString(),
      leadTimeDays: null,
      bestOverlap: Math.round(bestOverlap * 1000) / 1000
    };
  }

  const leadTimeMs = new Date(detectionDate).getTime() - finalMembership;

  return {
    scenarioId: gtRing.scenarioId,
    family: gtRing.family,
    memberCount: gtRing.members.length,
    detected: true,
    detectionDate,
    detectedRingId,
    finalMembershipDate: new Date(finalMembership).toISOString(),
    leadTimeDays: roundDays(leadTimeMs / 86400000),
    bestOverlap: Math.round(bestOverlap * 1000) / 1000
  };
}

/**
 * Computes lead time for every GT ring in a seed. A single set of weekly
 * snapshot ring-analyses is computed once per seed and shared across rings.
 */
function analyzeSeedLeadTime(dataset, groundTruth, options) {
  const gtRings = gtRingsFromGroundTruth(groundTruth);
  const memberJoinDates = {};
  for (const gtCustomer of Object.entries(groundTruth.customers || {})) {
    const [cid, rec] = gtCustomer;
    if (rec.memberJoinDate) memberJoinDates[cid] = new Date(rec.memberJoinDate).getTime();
  }
  const ringsWithDates = gtRings.map(r => ({ ...r, memberJoinDates }));
  const ringScoreThreshold = options.ringScoreThreshold;
  const windowDays = options.snapshotWindowDays || 90;

  const minStartMs = Math.min(...ringsWithDates.map(r => minJoinMs(r) ?? datasetEndMs(dataset)));
  const endMs = datasetEndMs(dataset);
  const windowStart = minStartMs - windowDays * 86400000;
  const snapshotTimes = weeklySnapshotTimes(windowStart, Math.max(endMs, minStartMs));

  const snapshots = snapshotTimes.map(t => {
    const asOfDataset = filterDatasetAsOf(dataset, t);
    const result = graphEngine.analyzeRefundRings(asOfDataset);
    return {
      time: t,
      passingRings: ringScoreThreshold === undefined ? (result.rings || []) : passingRings(result.rings, ringScoreThreshold)
    };
  });

  const perRing = ringsWithDates.map(r => leadTimeForRing(r, snapshots, options));

  const detected = perRing.filter(r => r.detected);
  const missed = perRing.filter(r => !r.detected);

  const leadTimes = detected.map(r => r.leadTimeDays).sort((a, b) => a - b);
  const median = (arr) => {
    if (arr.length === 0) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  return {
    ringScoreThreshold,
    snapshotCount: snapshots.length,
    ringCount: perRing.length,
    detectedCount: detected.length,
    missedCount: missed.length,
    detectionRate: perRing.length === 0 ? 0 : detected.length / perRing.length,
    medianLeadTimeDays: median(leadTimes),
    minLeadTimeDays: leadTimes.length ? leadTimes[0] : null,
    maxLeadTimeDays: leadTimes.length ? leadTimes[leadTimes.length - 1] : null,
    missedScenarioIds: missed.map(r => r.scenarioId),
    perRing
  };
}

/** Serializes the per-ring lead-time table for one seed to a JSON file. */
function writeLeadTimeTable(seed, result, outputPath) {
  const fs = require('fs');
  const table = {
    seed,
    ringCount: result.ringCount,
    detectedCount: result.detectedCount,
    missedCount: result.missedCount,
    detectionRate: result.detectionRate,
    medianLeadTimeDays: result.medianLeadTimeDays,
    rows: result.perRing
  };
  fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(table, null, 2).replace(/\r\n/g, '\n'));
  return table;
}

module.exports = {
  WEEK_MS,
  roundDays,
  minJoinMs,
  maxJoinMs,
  datasetEndMs,
  weeklySnapshotTimes,
  leadTimeForRing,
  analyzeSeedLeadTime,
  writeLeadTimeTable
};