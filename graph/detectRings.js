/**
 * Customer focus: relationship projection + refund-ring candidate detection.
 *
 * The customer graph is a projection of the full heterogeneous graph onto
 * customer nodes, connected by derived relationship edges (shared IP, shared
 * device, optionally shared order/transaction context). Relationship groups
 * are built with indexes (resource -> customers) and expanded pair-by-pair
 * within each group, avoiding any O(n^2) scan across all entity pairs.
 */

const config = require('./config');
const { nodeId } = require('./buildGraph');
const { findConnectedComponents } = require('./components');

function toggleA(id) {
  const i = id.indexOf(':');
  return i === -1 ? id : id.slice(i + 1);
}

/**
 * Shared-resource index: resource value -> ascending customer id list.
 * Built once from the full graph's customer->resource edges.
 */
function buildResourceIndex(graph, edgeType, valueOf) {
  const index = new Map();
  for (const edge of graph.edges) {
    if (edge.type !== edgeType) continue;
    const fromType = edge.from.slice(0, edge.from.indexOf(':'));
    if (fromType !== config.nodeTypes.customer) continue;
    const customerId = toggleA(edge.from);
    const resource = valueOf(edge);
    if (!index.has(resource)) index.set(resource, new Set());
    index.get(resource).add(customerId);
  }
  const out = new Map();
  for (const [resource, set] of index) {
    if (set.size >= config.relationshipMinMembers) out.set(resource, [...set].sort());
  }
  return out;
}

/**
 * @param {ReturnType<typeof import('./buildGraph').buildGraph>} graph
 * @returns {{ nodes: Map, edges: Array<{customerA,customerB,relationship,sharedValue,weight}>, adjacency: Map }}
 */
function buildCustomerGraph(graph) {
  const nodes = new Map();
  for (const node of graph.nodes.values()) {
    if (node.type === config.nodeTypes.customer) {
      nodes.set(node.data.customerId, { id: node.data.customerId, type: 'customer', data: node.data });
    }
  }

  const sharedIps = buildResourceIndex(graph, config.edgeTypes.customerIp, (e) => toggleA(e.to));
  const sharedDevices = buildResourceIndex(graph, config.edgeTypes.customerDevice, (e) => toggleA(e.to));

  const groups = [
    ...[...sharedIps.entries()].map(([value, customers]) => ({ relationship: 'shared_ip', value, customers })),
    ...[...sharedDevices.entries()].map(([value, customers]) => ({ relationship: 'shared_device', value, customers })),
  ];

  if (config.includeSharedTransactionContext) {
    const sharedOrders = buildResourceIndex(
      graph,
      config.edgeTypes.customerTransaction,
      (e) => (e.metadata && e.metadata.orderId) || ''
    );
    for (const [value, customers] of sharedOrders) {
      groups.push({ relationship: 'shared_transaction_context', value, customers });
    }
  }

  const edges = [];
  for (const group of groups) {
    const { relationship, value, customers } = group;
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        edges.push({
          customerA: customers[i],
          customerB: customers[j],
          relationship,
          sharedValue: value,
          weight: 1,
        });
      }
    }
  }

  edges.sort(
    (a, b) =>
      a.customerA < b.customerA ? -1 :
      a.customerA > b.customerA ? 1 :
      a.customerB < b.customerB ? -1 :
      a.customerB > b.customerB ? 1 :
      a.relationship < b.relationship ? -1 :
      a.relationship > b.relationship ? 1 :
      a.sharedValue < b.sharedValue ? -1 : 1
  );

  const adjacency = new Map();
  for (const customerId of nodes.keys()) adjacency.set(customerId, []);
  for (const edge of edges) {
    if (!adjacency.get(edge.customerA).includes(edge.customerB)) adjacency.get(edge.customerA).push(edge.customerB);
    if (!adjacency.get(edge.customerB).includes(edge.customerA)) adjacency.get(edge.customerB).push(edge.customerA);
  }
  for (const neighbors of adjacency.values()) neighbors.sort();

  return { nodes, edges, adjacency };
}

/**
 * @param {{ nodes: Map, edges: Array, adjacency: Map }} customerGraph
 * @param {object} [options]
 * @returns {Array<object>} ring candidates, each:
 *   { ringId, customerIds, memberCount, relationshipEdges, relationshipTypes, density }
 */
function detectRingCandidates(customerGraph, options = {}) {
  const minimumMembers = options.minimumMembers ?? config.ringCandidate.minimumMembers;
  const minimumRelationshipEdges = options.minimumRelationshipEdges ?? config.ringCandidate.minimumRelationshipEdges;

  const components = options.components || findConnectedComponents(customerGraph);
  const candidates = [];

  for (const component of components) {
    if (component.length < minimumMembers) continue;

    const memberSet = new Set(component);
    const internalEdges = customerGraph.edges.filter(
      (e) => memberSet.has(e.customerA) && memberSet.has(e.customerB)
    );
    if (internalEdges.length < minimumRelationshipEdges) continue;

    const possibleEdges = (component.length * (component.length - 1)) / 2;
    const uniquePairs = new Set(internalEdges.map((e) => `${e.customerA}|${e.customerB}`));

    const relationshipTypes = [...new Set(internalEdges.map((e) => e.relationship))].sort();

    candidates.push({
      ringId: `ring_${component[0]}`,
      customerIds: [...component],
      memberCount: component.length,
      relationshipEdges: internalEdges,
      relationshipTypes,
      density: possibleEdges === 0 ? 0 : uniquePairs.size / possibleEdges,
    });
  }

  candidates.sort((a, b) => b.memberCount - a.memberCount || (a.ringId < b.ringId ? -1 : 1));

  return candidates;
}

module.exports = { buildCustomerGraph, detectRingCandidates };