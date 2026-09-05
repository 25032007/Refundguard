/**
 * Deterministic, explainable ring scoring.
 *
 * Every point of the 0-100 score is backed by a measurable fact; no hidden
 * weight or black-box component. Contributions are separately bounded by the
 * config budget (maximising the sum to 100) but each is earned only by actual
 * evidence.
 *
 * Density convention (documented): density counts unique customer pairs that
 * share at least one relationship, not each relationship type as a separate
 * edge.
 */

const config = require('./config');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function severityForScore(score) {
  for (const band of config.severity) {
    if (score <= band.max) return band.label;
  }
  return 'critical';
}

function signalSeverity(contribution, max) {
  const share = max === 0 ? 0 : contribution / max;
  for (const band of config.signalSeverity) {
    if (share <= band.maxShare) return band.label;
  }
  return 'critical';
}

function pairsWithinRing(memberCount) {
  return (memberCount * (memberCount - 1)) / 2;
}

function sizeFactor(memberCount) {
  return clamp(memberCount / config.scoring.sizeFactorMaxMembers, 0, 1);
}

/** Distinct member pairs connected by a given relationship type. */
function sharedPairCount(candidate, relationship) {
  const pairs = new Set();
  for (const edge of candidate.relationshipEdges) {
    if (edge.relationship !== relationship) continue;
    pairs.add(`${edge.customerA}|${edge.customerB}`);
  }
  return pairs.size;
}

/** Distinct member pairs connected under any relationship type. */
function uniqueRelationshipPairs(candidate) {
  const pairs = new Set();
  for (const edge of candidate.relationshipEdges) {
    pairs.add(`${edge.customerA}|${edge.customerB}`);
  }
  return pairs.size;
}

/**
 * @param {object} candidate ring candidate
 * @param {object} evidence evidence from extractRingEvidence
 * @returns {{ score: number, severity: string, signals: Array<object> }}
 */
function scoreRing(candidate, evidence) {
  const c = config.scoring;
  const possiblePairs = pairsWithinRing(candidate.memberCount) || 1;

  // Shared IP ---------------------------------------------------------
  const ipPairs = sharedPairCount(candidate, config.relationshipTypes.sharedIp);
  const ipCoverage = possiblePairs === 0 ? 0 : ipPairs / possiblePairs;
  const sharedIpContribution = round1(c.sharedIp * ipCoverage * sizeFactor(candidate.memberCount));

  // Shared device -----------------------------------------------------
  const devicePairs = sharedPairCount(candidate, config.relationshipTypes.sharedDevice);
  const deviceCoverage = possiblePairs === 0 ? 0 : devicePairs / possiblePairs;
  const sharedDeviceContribution = round1(
    c.sharedDevice * deviceCoverage * sizeFactor(candidate.memberCount)
  );

  // Graph density (unique customer pairs under any relationship) ------
  const uniquePairs = uniqueRelationshipPairs(candidate);
  const densityContribution = round1(c.density * clamp(uniquePairs / possiblePairs, 0, 1));

  // Refund concentration ---------------------------------------------
  const rate = evidence.ringRefundRate || 0;
  const concentration = clamp((rate - c.refundRateBaseline) / (1 - c.refundRateBaseline), 0, 1);
  const refundContribution = round1(c.refundConcentration * concentration);

  // Multi-member refund activity --------------------------------------
  const refundActivity = round1(
    c.multiMemberRefundActivity * (evidence.membersWithRefunds / candidate.memberCount)
  );

  // Complaint concentration -------------------------------------------
  const complaintContribution = round1(
    c.complaintConcentration * (evidence.membersWithComplaints / candidate.memberCount)
  );

  const signals = [
    {
      type: config.relationshipTypes.sharedIp,
      severity: signalSeverity(sharedIpContribution, c.sharedIp),
      contribution: sharedIpContribution,
      description: describeSharedResource(evidence.sharedIps, candidate, 'IP'),
      evidence: evidence.sharedIps,
    },
    {
      type: config.relationshipTypes.sharedDevice,
      severity: signalSeverity(sharedDeviceContribution, c.sharedDevice),
      contribution: sharedDeviceContribution,
      description: describeSharedResource(evidence.sharedDevices, candidate, 'device'),
      evidence: evidence.sharedDevices,
    },
    {
      type: 'graph_density',
      severity: signalSeverity(densityContribution, c.density),
      contribution: densityContribution,
      description:
        `Ring density ${uniquePairs}/${possiblePairs} (${(candidate.density * 100).toFixed(0)}% of member pairs are connected through a shared resource).`,
      evidence: { uniqueMemberPairs: uniquePairs, possiblePairs, memberCount: candidate.memberCount },
    },
    {
      type: 'refund_concentration',
      severity: signalSeverity(refundContribution, c.refundConcentration),
      contribution: refundContribution,
      description:
        `Ring refund rate ${(rate * 100).toFixed(0)}% (${evidence.ringRefunds}/${evidence.ringTransactions} transactions) vs a ${(c.refundRateBaseline * 100).toFixed(0)}% baseline.`,
      evidence: {
        ringTransactions: evidence.ringTransactions,
        ringRefunds: evidence.ringRefunds,
        ringRefundRate: evidence.ringRefundRate,
      },
    },
    {
      type: 'multi_member_refund_activity',
      severity: signalSeverity(refundActivity, c.multiMemberRefundActivity),
      contribution: refundActivity,
      description: `${evidence.membersWithRefunds} of ${candidate.memberCount} members have at least one refund.`,
      evidence: {
        membersWithRefunds: evidence.membersWithRefunds,
        memberCount: candidate.memberCount,
      },
    },
    {
      type: 'complaint_concentration',
      severity: signalSeverity(complaintContribution, c.complaintConcentration),
      contribution: complaintContribution,
      description: `${evidence.membersWithComplaints} of ${candidate.memberCount} members filed at least one complaint.`,
      evidence: {
        membersWithComplaints: evidence.membersWithComplaints,
        memberCount: candidate.memberCount,
      },
    },
  ];

  let score = signals.reduce((sum, s) => sum + s.contribution, 0);
  score = round1(clamp(score, 0, c.maxScore));

  return { score, severity: severityForScore(score), signals };
}

/** Human-readable sentence for shared-resource signals. */
function describeSharedResource(groups, candidate, kind) {
  const total = groups.reduce((s, g) => s + g.customers.length, 0);
  if (total === 0) {
    return `No ring members share an ${kind.toLowerCase()} address.`;
  }
  const count = groups.length;
  const noun = kind === 'IP' ? (count === 1 ? 'shared IP' : 'shared IPs') : (count === 1 ? 'shared device' : 'shared devices');
  const verb = count === 1 ? 'connects' : 'connect';
  return `${count} ${noun} ${verb} ${candidate.memberCount} ring members (${total} shared-resource uses).`;
}

module.exports = { scoreRing };