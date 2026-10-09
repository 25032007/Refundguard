/**
 * Phase 3 lead-time / detection-delay evaluation (temporal detection).
 *
 * For every ground-truth ring we compute:
 *   - detectionDate:   first weekly snapshot (using analyzeAsOf / filterDatasetAsOf)
 *                      where a detected ring (score >= ringScore threshold) has
 *                      member overlap >= 0.5 with the ground-truth ring.
 *   - finalMembershipDate: max memberJoinDate across ground-truth ring members.
 *   - detectionDelayDays: (detectionDate - finalMembershipDate) / 86400000.
 *                      POSITIVE means the ring was detected AFTER it fully
 *                      formed (late detection); negative means before (early).
 *   - leadTimeDays:    -detectionDelayDays, i.e. (finalMembership - detection)/day.
 *                      POSITIVE means the ring was detected before it fully
 *                      formed (early); negative means late. "Lead time" is only
 *                      used for rings detected early (positive); late rings are
 *                      reported as a detection delay, never as "lead time".
 *
 * Reported per seed and pooled across seeds:
 *   - detection rate
 *   - early-or-on-time rate (leadTimeDays >= 0) over ALL rings
 *   - median lead time over early-detected rings (leadTimeDays > 0)
 *   - median detection delay over late-detected rings (detectionDelayDays > 0)
 *   - the same per scenario family, plus missed rings per family.
 *
 * For the obvious and noisy rings a per-snapshot as-of ring score is recorded
 * (from first membership through detection) so late detections can be audited
 * as snapshot-cadence vs detector slowness.
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

/** Overlap between a detected ring (customerIds) and a ground-truth member set. */
function overlapWith(gtMembers, ringCustomerIds) {
  let inter = 0;
  for (const m of ringCustomerIds || []) if (gtMembers.has(m)) inter++;
  const union = gtMembers.size + (ringCustomerIds || []).length - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Per-snapshot as-of ring score (best-overlap detected ring) from the snapshot
 * at/after first membership through the detection snapshot. Enables auditing
 * snapshot cadence vs detector slowness for structurally detectable families.
 */
function buildAsOfScores(gtRing, gtMembers, snapshots, firstMembershipMs, detectionDate) {
  if (firstMembershipMs === null) return [];
  const detectionMs = new Date(detectionDate).getTime();
  const rows = [];
  for (const snap of snapshots) {
    const t = new Date(snap.time).getTime();
    if (t < firstMembershipMs) continue;
    if (t > detectionMs) break;
    const allRings = snap.allRings || [];
    let best = null;
    let bestOverlap = 0;
    for (const ring of allRings) {
      const ov = overlapWith(gtMembers, ring.customerIds);
      if (ov > bestOverlap) {
        bestOverlap = ov;
        best = ring;
      }
    }
    rows.push({ date: snap.time, score: best === null || best.score === undefined ? null : Math.round(best.score * 100) / 100 });
  }
  return rows;
}

/**
 * Computes lead time / detection delay for one ground-truth ring against
 * precomputed snapshot analyses.
 *
 * @param {object} gtRing  ground-truth ring with members and memberJoinDates
 * @param {Array<{time: string, passingRings: Array<object>, allRings: Array<object>}>} snapshots
 * @param {object} options { overlapThreshold, asOfFamilies }
 * @returns object with detection info and per-snapshot as-of scores.
 */
function leadTimeForRing(gtRing, snapshots, options) {
  const overlapThreshold = options.overlapThreshold || RING_MATCH_OVERLAP;
  const asOfFamilies = options.asOfFamilies || [];
  const wantsAsOf = asOfFamilies.includes(gtRing.family);

  const gtMembers = new Set(gtRing.members);
  let detectionDate = null;
  let detectedRingId = null;
  let bestOverlap = 0;

  for (const snap of snapshots) {
    for (const ring of snap.passingRings) {
      // Note: passingRings are score-filtered at analysis time; re-check for safety.
      const overlap = overlapWith(gtMembers, ring.customerIds);
      if (overlap > bestOverlap) bestOverlap = overlap;
      if (overlap >= overlapThreshold && detectionDate === null) {
        detectionDate = snap.time;
        detectedRingId = ring.ringId;
      }
    }
    if (detectionDate !== null) break; // first qualifying snapshot
  }

  const finalMembership = maxJoinMs(gtRing);
  const firstMembership = minJoinMs(gtRing);

  const base = {
    scenarioId: gtRing.scenarioId,
    family: gtRing.family,
    memberCount: gtRing.members.length,
    detected: false,
    detectionDate: null,
    detectedRingId: null,
    firstMembershipDate: firstMembership === null ? null : new Date(firstMembership).toISOString(),
    finalMembershipDate: finalMembership === null ? null : new Date(finalMembership).toISOString(),
    leadTimeDays: null,
    detectionDelayDays: null,
    bestOverlap: Math.round(bestOverlap * 1000) / 1000
  };

  if (detectionDate === null) {
    return wantsAsOf ? { ...base, asOfScores: [] } : base;
  }

  const detectionMs = new Date(detectionDate).getTime();
  const delayDays = roundDays((detectionMs - finalMembership) / 86400000);

  return wantsAsOf
    ? {
        ...base,
        detected: true,
        detectedRingId,
        detectionDate,
        leadTimeDays: -delayDays,
        detectionDelayDays: delayDays,
        asOfScores: buildAsOfScores(gtRing, gtMembers, snapshots, firstMembership, detectionDate)
      }
    : {
        ...base,
        detected: true,
        detectedRingId,
        detectionDate,
        leadTimeDays: -delayDays,
        detectionDelayDays: delayDays
      };
}

/**
 * Computes lead time / detection delay for every GT ring in a seed. A single
 * set of weekly snapshot ring-analyses is computed once per seed and shared
 * across rings.
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
  const asOfFamilies = options.asOfFamilies || [];

  const minStartMs = Math.min(...ringsWithDates.map(r => minJoinMs(r) ?? datasetEndMs(dataset)));
  const endMs = datasetEndMs(dataset);
  const windowStart = minStartMs - windowDays * 86400000;
  const snapshotTimes = weeklySnapshotTimes(windowStart, Math.max(endMs, minStartMs));

  const snapshots = snapshotTimes.map(t => {
    const asOfDataset = filterDatasetAsOf(dataset, t);
    const result = graphEngine.analyzeRefundRings(asOfDataset);
    return {
      time: t,
      allRings: result.rings || [],
      passingRings: ringScoreThreshold === undefined ? (result.rings || []) : passingRings(result.rings, ringScoreThreshold)
    };
  });

  const perRing = ringsWithDates.map(r => leadTimeForRing(r, snapshots, { overlapThreshold: options.overlapThreshold, asOfFamilies }));

  const detected = perRing.filter(r => r.detected);
  const missed = perRing.filter(r => !r.detected);

  const earlyOrOnTimeCount = detected.filter(r => r.leadTimeDays !== null && r.leadTimeDays >= 0).length;
  const earlyRings = detected.filter(r => r.leadTimeDays !== null && r.leadTimeDays > 0);
  const lateRings = detected.filter(r => r.detectionDelayDays !== null && r.detectionDelayDays > 0);

  const median = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const perFamily = aggregatePerFamily(perRing, median);

  return {
    ringScoreThreshold,
    snapshotCount: snapshotTimes.length,
    snapshotDates: snapshotTimes,
    ringCount: perRing.length,
    detectedCount: detected.length,
    missedCount: missed.length,
    detectionRate: perRing.length === 0 ? 0 : detected.length / perRing.length,
    earlyOrOnTimeCount,
    earlyOrOnTimeRate: perRing.length === 0 ? 0 : earlyOrOnTimeCount / perRing.length,
    lateCount: lateRings.length,
    medianLeadTimeDays: earlyRings.length ? median(earlyRings.map(r => r.leadTimeDays)) : null,
    medianDetectionDelayDays: lateRings.length ? median(lateRings.map(r => r.detectionDelayDays)) : null,
    perFamily,
    missedScenarioIds: missed.map(r => r.scenarioId),
    perRing
  };
}

/** Per-family aggregation within one seed (each family usually contributes one ring). */
function aggregatePerFamily(perRing, median) {
  const byFamily = {};
  for (const r of perRing) {
    const fam = (byFamily[r.family] = byFamily[r.family] || {
      family: r.family,
      ringCount: 0,
      detectedCount: 0,
      missedCount: 0,
      earlyOrOnTimeCount: 0,
      lateCount: 0,
      earlyLeadTimes: [],
      lateDelays: []
    });
    fam.ringCount++;
    if (r.detected) {
      fam.detectedCount++;
      if (r.leadTimeDays !== null && r.leadTimeDays >= 0) fam.earlyOrOnTimeCount++;
      if (r.leadTimeDays !== null && r.leadTimeDays > 0) fam.earlyLeadTimes.push(r.leadTimeDays);
      if (r.detectionDelayDays !== null && r.detectionDelayDays > 0) {
        fam.lateCount++;
        fam.lateDelays.push(r.detectionDelayDays);
      }
    } else {
      fam.missedCount++;
    }
  }
  return Object.keys(byFamily).sort().map(f => {
    const fam = byFamily[f];
    return {
      family: f,
      ringCount: fam.ringCount,
      detectedCount: fam.detectedCount,
      missedCount: fam.missedCount,
      detectionRate: fam.ringCount === 0 ? 0 : fam.detectedCount / fam.ringCount,
      earlyOrOnTimeCount: fam.earlyOrOnTimeCount,
      earlyOrOnTimeRate: fam.ringCount === 0 ? 0 : fam.earlyOrOnTimeCount / fam.ringCount,
      lateCount: fam.lateCount,
      medianLeadTimeDays: fam.earlyLeadTimes.length ? median(fam.earlyLeadTimes) : null,
      medianDetectionDelayDays: fam.lateDelays.length ? median(fam.lateDelays) : null
    };
  });
}

/** Serializes the per-ring lead-time table for one seed to a JSON file. */
function writeLeadTimeTable(seed, result, outputPath) {
  const fs = require('fs');
  const table = {
    seed,
    snapshotDates: result.snapshotDates,
    ringCount: result.ringCount,
    detectedCount: result.detectedCount,
    missedCount: result.missedCount,
    detectionRate: result.detectionRate,
    earlyOrOnTimeCount: result.earlyOrOnTimeCount,
    earlyOrOnTimeRate: result.earlyOrOnTimeRate,
    lateCount: result.lateCount,
    medianLeadTimeDays: result.medianLeadTimeDays,
    medianDetectionDelayDays: result.medianDetectionDelayDays,
    perFamily: result.perFamily,
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
  overlapWith,
  buildAsOfScores,
  leadTimeForRing,
  analyzeSeedLeadTime,
  aggregatePerFamily,
  writeLeadTimeTable
};