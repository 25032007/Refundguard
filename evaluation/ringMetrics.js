/**
 * Phase 3 ring-level evaluation metrics.
 *
 * Pure, deterministic functions evaluating the ring detector (graph engine's
 * refund-ring output) against ground-truth injected scenario clusters.
 *
 * Conventions (documented in docs/EVALUATION.md):
 *   - GROUND-TRUTH RINGS: injected scenario clusters with memberCount >= 3.
 *     burst_refund clusters have 2 members and are not evaluated as rings.
 *   - DETECTED RINGS: graph-engine rings with score >= ringScore threshold
 *     (chosen on development seeds only).
 *   - OVERLAP: Jaccard similarity between the member sets.
 *   - A detected ring is a false positive (FP) when it has no ground-truth
 *     ring with overlap >= RING_MATCH_OVERLAP (0.5). Ring-level FPs are then
 *     classified by the dominant legitimate group type of their members.
 */

const { jaccardSimilarity } = require('../graph/lifecycle');
const { MIN_RING_MEMBERS, RING_MATCH_OVERLAP } = require('./seeds');

/** Returns ground-truth rings that qualify for ring-level evaluation. */
function gtRingsFromGroundTruth(groundTruth) {
  return (groundTruth.scenarios || []).filter(s => (s.members || []).length >= MIN_RING_MEMBERS);
}

/** Detected rings passing the ringScore threshold (score >= threshold). */
function passingRings(rings, ringScoreThreshold) {
  return (rings || []).filter(r => r.score >= ringScoreThreshold);
}

/** Orders detected rings deterministically (score desc, then ringId asc). */
function sortDetectedRings(rings) {
  return [...rings].sort((a, b) => b.score - a.score || (a.ringId < b.ringId ? -1 : 1));
}

/**
 * For each ground-truth ring, finds the best detected-ring overlap
 * (max Jaccard) among the detected rings passed in.
 * Returns [{ gtRing, bestOverlap, detectedRing|null, detectedId|null }].
 * Single pass; per-GT-ring max. Deterministic tie-break by ringId.
 */
function bestOverlapPerGtRing(gtRings, detectedRings) {
  const sorted = sortDetectedRings(detectedRings);
  return gtRings.map(gt => {
    let bestOverlap = 0;
    let bestRing = null;
    for (const d of sorted) {
      const j = jaccardSimilarity(new Set(gt.members), new Set(d.customerIds || []));
      if (j > bestOverlap) {
        bestOverlap = j;
        bestRing = d;
      }
    }
    return { gtRing: gt, bestOverlap, detectedRing: bestRing, detectedId: bestRing ? bestRing.ringId : null };
  });
}

/**
 * Recovery summary: for each overlap threshold, the fraction of GT rings whose
 * best overlap with any passing detected ring is >= threshold.
 */
function recoverySummary(gtRings, detectedRings, recoveryThresholds) {
  const matches = bestOverlapPerGtRing(gtRings, detectedRings);
  const total = gtRings.length;
  const out = {};
  for (const t of recoveryThresholds) {
    const recovered = matches.filter(m => m.bestOverlap >= t).length;
    out[String(t)] = {
      recovered,
      total,
      rate: total === 0 ? 0 : recovered / total
    };
  }
  return { matches, recovery: out };
}

/**
 * Classifies detected rings into true positives (matched to a GT ring with
 * overlap >= matchOverlap) and false positives (no GT ring above threshold).
 *
 * Each FP is classified by the dominant group of its legit members:
 *   groupOf(customer) = first of the known legit group categories present in
 *   the customer's ground-truth categories (order matters: household, office,
 *   hostel, wholesaler, normal are mutually exclusive primary groups; the
 *   high-refund-rate category is secondary and only used when no primary group
 *   is present).
 */
const PRIMARY_GROUPS = ['LEGITIMATE_HOUSEHOLD', 'LEGITIMATE_OFFICE', 'LEGITIMATE_HOSTEL', 'LEGITIMATE_WHOLESALER', 'LEGITIMATE_NORMAL'];
const SECONDARY_GROUP = 'LEGITIMATE_HIGH_REFUND_RATE';

function groupOfCustomer(gtCustomerMap, customerId) {
  const gt = gtCustomerMap && gtCustomerMap[customerId];
  if (!gt) return 'UNKNOWN';
  const cats = gt.categories || [];
  for (const g of PRIMARY_GROUPS) {
    if (cats.includes(g)) return g;
  }
  if (cats.includes(SECONDARY_GROUP)) return SECONDARY_GROUP;
  return 'UNKNOWN';
}

function classifyRings({ gtRings, detectedRings, gtCustomerMap, ringScoreThreshold, matchOverlap }) {
  const sorted = sortDetectedRings(passingRings(detectedRings, ringScoreThreshold));
  const overlaps = bestOverlapPerGtRing(gtRings, sorted);

  const fpRings = sorted.filter(d => !overlaps.some(o => o.detectedRing === d && o.bestOverlap >= matchOverlap));

  const classifiedFps = fpRings.map(ring => {
    const members = ring.customerIds || [];
    const legitMembers = members.filter(m => {
      const gt = gtCustomerMap && gtCustomerMap[m];
      return gt && gt.label === 'LEGITIMATE';
    });
    const fraudMembers = members.filter(m => {
      const gt = gtCustomerMap && gtCustomerMap[m];
      return gt && gt.label === 'FRAUD';
    });
    const groupCounts = {};
    for (const m of legitMembers) {
      const g = groupOfCustomer(gtCustomerMap, m);
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    }
    const groups = Object.keys(groupCounts).sort();
    let group = groups.length ? groups[0] : 'UNKNOWN';
    let maxCount = -1;
    for (const g of groups) {
      if (groupCounts[g] > maxCount) {
        maxCount = groupCounts[g];
        group = g;
      }
    }
    return {
      ringId: ring.ringId,
      memberCount: members.length,
      score: ring.score,
      severity: ring.severity,
      legitMemberCount: legitMembers.length,
      fraudMemberCount: fraudMembers.length,
      group
    };
  });

  // Per-group FP counts (deterministic key order).
  const fpByGroup = {};
  for (const fp of classifiedFps) {
    fpByGroup[fp.group] = (fpByGroup[fp.group] || 0) + 1;
  }

  const matched = overlaps.filter(o => o.bestOverlap >= matchOverlap).length;
  return {
    detectedPassingCount: sorted.length,
    matchedCount: matched,
    fpRingCount: classifiedFps.length,
    fpByGroup,
    fpRings: classifiedFps,
    overlaps
  };
}

/**
 * Aggregates per-seed recovery summaries: summed recovered/total over seeds.
 */
function aggregateRecovery(perSeedSummaries, recoveryThresholds) {
  const out = {};
  for (const t of recoveryThresholds) {
    let recovered = 0;
    let total = 0;
    for (const s of perSeedSummaries) {
      recovered += s.recovery[String(t)].recovered;
      total += s.recovery[String(t)].total;
    }
    out[String(t)] = { recovered, total, rate: total === 0 ? 0 : recovered / total };
  }
  return out;
}

/** Sums ring-level false-positive counts by group over train of seed results. */
function aggregateFpByGroup(perSeedClassifications) {
  const out = {};
  for (const c of perSeedClassifications) {
    for (const [group, count] of Object.entries(c.fpByGroup)) {
      out[group] = (out[group] || 0) + count;
    }
  }
  return out;
}

module.exports = {
  gtRingsFromGroundTruth,
  passingRings,
  sortDetectedRings,
  bestOverlapPerGtRing,
  recoverySummary,
  classifyRings,
  groupOfCustomer,
  aggregateRecovery,
  aggregateFpByGroup,
  PRIMARY_GROUPS,
  SECONDARY_GROUP
};