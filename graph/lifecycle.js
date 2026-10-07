/**
 * RefundGuard Temporal Ring Lifecycle & Emerging-Ring Detection (Phase 3B).
 *
 * Implements deterministic temporal ring snapshots, ring identity tracking
 * across time, explicit state transitions (EMERGING -> ACTIVE -> DORMANT -> DISBANDED),
 * and emerging-ring detection without look-ahead leakage.
 */

const config = require('./config');
const { filterDatasetAsOf } = require('../risk-engine/temporal');
const { toMs } = require('../risk-engine/utils/dates');

const RING_LIFECYCLE_CONFIG = config.lifecycle;

/**
 * Computes Jaccard Similarity between two sets.
 */
function jaccardSimilarity(setA, setB) {
  if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const elem of setA) {
    if (setB.has(elem)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Extracts resource values (IPs and deviceIds) from a ring candidate's evidence.
 */
function extractRingResources(ring) {
  const ips = [];
  const devices = [];
  if (ring.evidence && ring.evidence.sharedIps) {
    for (const item of ring.evidence.sharedIps) {
      if (item.ip) ips.push(item.ip);
    }
  }
  if (ring.evidence && ring.evidence.sharedDevices) {
    for (const item of ring.evidence.sharedDevices) {
      if (item.deviceId) devices.push(item.deviceId);
    }
  }
  return { ips: ips.sort(), devices: devices.sort() };
}

/**
 * Matches detected ring candidates at current snapshot to tracked persistent rings.
 * Uses deterministic Jaccard member overlap matching to preserve ring identity.
 *
 * @param {Array<object>} currentCandidates - Candidates detected in current snapshot
 * @param {Map<string, object>} trackedRings - Currently tracked persistent rings state
 * @param {object} [options]
 * @returns {Array<{candidate: object, matchedTrackedRing: object|null, assignedRingId: string}>}
 */
function matchRings(currentCandidates, trackedRings, options = {}) {
  const overlapThreshold = options.overlapThreshold ?? RING_LIFECYCLE_CONFIG.overlapThreshold;

  const candidateSets = currentCandidates.map(c => ({
    candidate: c,
    set: new Set(c.customerIds),
  }));

  const matches = [];
  const assignedTrackedIds = new Set();

  for (const { candidate, set } of candidateSets) {
    let bestTracked = null;
    let maxSim = 0;

    for (const tracked of trackedRings.values()) {
      if (assignedTrackedIds.has(tracked.ringId)) continue;
      const trackedSet = new Set(tracked.customerIds);
      const sim = jaccardSimilarity(set, trackedSet);

      if (sim >= overlapThreshold && sim > maxSim) {
        maxSim = sim;
        bestTracked = tracked;
      }
    }

    if (bestTracked) {
      assignedTrackedIds.add(bestTracked.ringId);
      matches.push({
        candidate,
        matchedTrackedRing: bestTracked,
        assignedRingId: bestTracked.ringId,
      });
    } else {
      // New ring: assign stable canonical ID derived from minimum customer ID
      const minId = [...candidate.customerIds].sort()[0];
      let proposedId = `ring_${minId}`;

      if (trackedRings.has(proposedId)) {
        let seq = 2;
        while (trackedRings.has(`${proposedId}_${seq}`)) {
          seq++;
        }
        proposedId = `${proposedId}_${seq}`;
      }

      matches.push({
        candidate,
        matchedTrackedRing: null,
        assignedRingId: proposedId,
      });
    }
  }

  return matches;
}

/**
 * Generates deterministic temporal ring snapshots across specified snapshot timestamps.
 *
 * @param {object} dataset - Full dataset
 * @param {Array<string|number|Date>} snapshotTimes - Chronological timestamps
 * @param {object} [options]
 * @returns {Array<object>} Snapshots array
 */
function getRingSnapshots(dataset, snapshotTimes, options = {}) {
  const { analyzeRefundRings } = require('./index');

  if (!Array.isArray(snapshotTimes) || snapshotTimes.length === 0) {
    throw new Error('snapshotTimes must be a non-empty array');
  }

  const sortedTimes = [...snapshotTimes].sort((a, b) => toMs(a) - toMs(b));
  const cfg = { ...RING_LIFECYCLE_CONFIG, ...options };
  const trackedRings = new Map();
  const snapshots = [];

  for (const t of sortedTimes) {
    const timeIso = new Date(toMs(t)).toISOString();
    const temporalDataset = filterDatasetAsOf(dataset, t);
    const analysis = analyzeRefundRings(temporalDataset);
    const candidates = analysis.rings || [];

    const matches = matchRings(candidates, trackedRings, cfg);
    const matchedRingIds = new Set(matches.map(m => m.assignedRingId));

    const snapshotRings = [];

    // 1. Process detected ring candidates in this snapshot
    for (const { candidate, matchedTrackedRing, assignedRingId } of matches) {
      const { ips, devices } = extractRingResources(candidate);
      let prevState = matchedTrackedRing ? matchedTrackedRing.state : null;
      let firstSeenAt = matchedTrackedRing ? matchedTrackedRing.firstSeenAt : timeIso;

      const evidenceTriggers = [];
      const newMembers = [];
      const newResources = [];

      if (!matchedTrackedRing) {
        evidenceTriggers.push('NEW_RING');
      } else {
        const prevMemberSet = new Set(matchedTrackedRing.customerIds);
        for (const cid of candidate.customerIds) {
          if (!prevMemberSet.has(cid)) newMembers.push(cid);
        }
        if (newMembers.length > 0) {
          evidenceTriggers.push('MEMBER_COUNT_INCREASE');
        }

        const prevIps = new Set(matchedTrackedRing.ips || []);
        for (const ip of ips) {
          if (!prevIps.has(ip)) newResources.push(`ip:${ip}`);
        }
        if (ips.some(ip => !prevIps.has(ip))) {
          evidenceTriggers.push('NEW_SHARED_IP');
        }

        const prevDevs = new Set(matchedTrackedRing.devices || []);
        for (const dev of devices) {
          if (!prevDevs.has(dev)) newResources.push(`device:${dev}`);
        }
        if (devices.some(dev => !prevDevs.has(dev))) {
          evidenceTriggers.push('NEW_SHARED_DEVICE');
        }

        if (candidate.score >= (matchedTrackedRing.score || 0) + 5) {
          evidenceTriggers.push('RISK_SCORE_INCREASE');
        }

        if (prevState === 'DORMANT' || prevState === 'DISBANDED') {
          evidenceTriggers.push('ACTIVITY_RESUMED');
        }
      }

      // State Transition Rule
      let newState = 'EMERGING';
      if (prevState === null) {
        newState = candidate.score >= cfg.minScoreForActive ? 'ACTIVE' : 'EMERGING';
      } else if (prevState === 'EMERGING') {
        if (candidate.score >= cfg.minScoreForActive || newMembers.length > 0) {
          newState = 'ACTIVE';
        } else {
          newState = 'EMERGING';
        }
      } else if (prevState === 'DORMANT' || prevState === 'DISBANDED') {
        newState = 'ACTIVE';
      } else if (prevState === 'ACTIVE') {
        newState = 'ACTIVE';
      }

      const ringState = {
        ringId: assignedRingId,
        state: newState,
        firstSeenAt,
        lastSeenAt: timeIso,
        memberCount: candidate.memberCount,
        previousMemberCount: matchedTrackedRing ? matchedTrackedRing.memberCount : 0,
        customerIds: candidate.customerIds,
        newMembers,
        newResources,
        ips,
        devices,
        score: candidate.score,
        severity: candidate.severity,
        evidenceTriggers,
        signals: candidate.signals,
        evidence: candidate.evidence,
        consecutiveMissed: 0,
      };

      trackedRings.set(assignedRingId, ringState);
      snapshotRings.push(ringState);
    }

    // 2. Process tracked rings NOT detected in this snapshot
    for (const [ringId, tracked] of trackedRings.entries()) {
      if (matchedRingIds.has(ringId)) continue;

      const consecutiveMissed = (tracked.consecutiveMissed || 0) + 1;
      let newState = tracked.state;

      if (tracked.state === 'EMERGING' || tracked.state === 'ACTIVE') {
        newState = 'DORMANT';
      } else if (tracked.state === 'DORMANT') {
        if (consecutiveMissed >= cfg.disbandedSnapshots) {
          newState = 'DISBANDED';
        }
      }

      const updatedTracked = {
        ...tracked,
        state: newState,
        consecutiveMissed,
        evidenceTriggers: ['NO_QUALIFYING_ACTIVITY'],
        newMembers: [],
        newResources: [],
      };

      trackedRings.set(ringId, updatedTracked);
      snapshotRings.push(updatedTracked);
    }

    snapshotRings.sort((a, b) => b.score - a.score || (a.ringId < b.ringId ? -1 : 1));

    snapshots.push({
      timestamp: timeIso,
      asOf: timeIso,
      ringCount: snapshotRings.length,
      rings: snapshotRings,
    });
  }

  return snapshots;
}

/**
 * Detects emerging rings by comparing previous and current snapshots.
 * Determines emerging rings strictly from previous snapshot + current snapshot (no future leakage).
 *
 * @param {object} previousSnapshot
 * @param {object} currentSnapshot
 * @returns {Array<object>} Explainable emerging ring objects
 */
function detectEmergingRings(previousSnapshot, currentSnapshot) {
  if (!currentSnapshot || !Array.isArray(currentSnapshot.rings)) return [];

  const prevMap = new Map();
  if (previousSnapshot && Array.isArray(previousSnapshot.rings)) {
    for (const ring of previousSnapshot.rings) {
      prevMap.set(ring.ringId, ring);
    }
  }

  const emerging = [];

  for (const ring of currentSnapshot.rings) {
    const prevRing = prevMap.get(ring.ringId);

    const isNewlySeen = !prevRing;
    const isEmergingState = ring.state === 'EMERGING';
    const isReactivated = prevRing && (prevRing.state === 'DORMANT' || prevRing.state === 'DISBANDED') && ring.state === 'ACTIVE';
    const hasGrowth = (ring.newMembers && ring.newMembers.length > 0) || (ring.newResources && ring.newResources.length > 0);

    if (isNewlySeen || isEmergingState || isReactivated || hasGrowth) {
      emerging.push({
        ringId: ring.ringId,
        state: ring.state,
        firstSeenAt: ring.firstSeenAt,
        lastSeenAt: ring.lastSeenAt,
        memberCount: ring.memberCount,
        previousMemberCount: prevRing ? prevRing.memberCount : 0,
        newMembers: ring.newMembers || [],
        newResources: ring.newResources || [],
        ringScore: ring.score,
        evidence: ring.evidenceTriggers || [],
      });
    }
  }

  return emerging;
}

/**
 * End-to-end temporal ring lifecycle analysis over snapshot timestamps.
 */
function analyzeRingLifecycle(dataset, snapshotTimes, options = {}) {
  const snapshots = getRingSnapshots(dataset, snapshotTimes, options);

  const emergingRingsBySnapshot = [];
  for (let i = 0; i < snapshots.length; i++) {
    const prev = i > 0 ? snapshots[i - 1] : null;
    const curr = snapshots[i];
    const emerging = detectEmergingRings(prev, curr);
    emergingRingsBySnapshot.push({
      timestamp: curr.timestamp,
      emergingCount: emerging.length,
      rings: emerging,
    });
  }

  const latestSnapshot = snapshots[snapshots.length - 1];

  return {
    snapshotCount: snapshots.length,
    snapshots,
    emergingRingsBySnapshot,
    currentTrackedRings: latestSnapshot ? latestSnapshot.rings : [],
  };
}

module.exports = {
  RING_LIFECYCLE_CONFIG,
  jaccardSimilarity,
  matchRings,
  getRingSnapshots,
  detectEmergingRings,
  analyzeRingLifecycle,
};
