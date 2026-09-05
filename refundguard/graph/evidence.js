/**
 * Ring evidence extraction. Turns a candidate + the full graph into observable
 * facts: shared resources, refund/complaint counts, and refund-rate state.
 * Only evidence actually present is included — nothing is fabricated.
 */

const config = require('./config');

function valuePart(nodeIdString) {
  const i = nodeIdString.indexOf(':');
  return i === -1 ? nodeIdString : nodeIdString.slice(i + 1);
}

/**
 * @param {object} candidate ring candidate (see detectRingCandidates)
 * @param {ReturnType<typeof import('./buildGraph').buildGraph>} graph
 * @returns {object} evidence
 */
function extractRingEvidence(candidate, graph) {
  const members = new Set(candidate.customerIds);

  // -- shared resources, grouped by value, from the candidate's relationship edges
  const sharedByValue = (relationship) => {
    const map = new Map();
    for (const edge of candidate.relationshipEdges) {
      if (edge.relationship !== relationship) continue;
      if (!map.has(edge.sharedValue)) map.set(edge.sharedValue, new Set());
      map.get(edge.sharedValue).add(edge.customerA);
      map.get(edge.sharedValue).add(edge.customerB);
    }
    return [...map.entries()]
      .map(([value, set]) => ({ [prefix(relationship)]: value, customers: [...set].sort() }))
      .sort((a, b) => {
        const av = Object.values(a)[0];
        const bv = Object.values(b)[0];
        return av < bv ? -1 : 1;
      });
  };

  const prefix = (relationship) =>
    relationship === config.relationshipTypes.sharedIp
      ? 'ip'
      : relationship === config.relationshipTypes.sharedDevice
        ? 'deviceId'
        : 'value';

  const sharedIps = sharedByValue(config.relationshipTypes.sharedIp);
  const sharedDevices = sharedByValue(config.relationshipTypes.sharedDevice);

  // -- behavioral counts from the full graph
  const transactionCounts = {};
  const refundCounts = {};
  const complaintCounts = {};

  for (const node of graph.nodes.values()) {
    if (node.type !== config.nodeTypes.customer) continue;
    const customerId = node.data.customerId;
    if (!members.has(customerId)) continue;
    transactionCounts[customerId] = 0;
    refundCounts[customerId] = 0;
    complaintCounts[customerId] = 0;
  }

  for (const edge of graph.edges) {
    const fromCustomer = valuePart(edge.from);
    if (edge.type === config.edgeTypes.customerTransaction && members.has(fromCustomer)) {
      transactionCounts[fromCustomer] = (transactionCounts[fromCustomer] || 0) + 1;
    } else if (edge.type === config.edgeTypes.customerComplaint && members.has(fromCustomer)) {
      complaintCounts[fromCustomer] = (complaintCounts[fromCustomer] || 0) + 1;
    } else if (edge.type === config.edgeTypes.transactionRefund) {
      const refundNode = graph.nodes.get(edge.to);
      if (!refundNode || !members.has(refundNode.data.customerId)) continue;
      refundCounts[refundNode.data.customerId] = (refundCounts[refundNode.data.customerId] || 0) + 1;
    }
  }

  const ringTransactions = Object.values(transactionCounts).reduce((s, v) => s + v, 0);
  const ringRefunds = Object.values(refundCounts).reduce((s, v) => s + v, 0);
  const ringRefundRate = ringTransactions === 0 ? 0 : ringRefunds / ringTransactions;

  const membersWithRefunds = Object.values(refundCounts).filter((v) => v > 0).length;
  const membersWithComplaints = Object.values(complaintCounts).filter((v) => v > 0).length;

  return {
    sharedIps,
    sharedDevices,
    refundCounts,
    complaintCounts,
    transactionCounts,
    ringTransactions,
    ringRefunds,
    ringRefundRate,
    membersWithRefunds,
    membersWithComplaints,
  };
}

module.exports = { extractRingEvidence };