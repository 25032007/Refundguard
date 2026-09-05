/**
 * Heterogeneous graph construction.
 *
 * Builds an in-memory graph of the six supported node types and the typed
 * edges the dataset actually supports. This module only builds the graph; it
 * computes no suspiciousness.
 */

const config = require('./config');

/**
 * Stable prefixed node ID, e.g. customer:cust_00001, ip:192.168.1.10.
 */
function nodeId(type, value) {
  return `${type}:${value}`;
}

/**
 * @param {object} dataset { customers, devices, transactions, refunds, complaints }
 * @returns {{
 *   nodes: Map<string, {id,type,data}>,
 *   edges: Array<{from,to,type,metadata}>,
 *   adjacency: Map<string, string[]>,
 *   stats: { customerNodes, deviceNodes, ipNodes, transactionNodes, refundNodes, complaintNodes, edgeCount }
 * }}
 */
function buildGraph(dataset) {
  const {
    customers = [],
    devices = [],
    transactions = [],
    refunds = [],
    complaints = [],
  } = dataset;

  const nodes = new Map();
  const edges = [];

  function addNode(type, id, data) {
    if (!nodes.has(id)) nodes.set(id, { id, type, data });
  }

  function addEdge(from, to, type, metadata = {}) {
    edges.push({ from, to, type, metadata });
  }

  // -- customers -------------------------------------------------------
  for (const customer of customers) {
    addNode(config.nodeTypes.customer, nodeId('customer', customer.customerId), customer);
  }

  // -- devices (catalog entry) -----------------------------------------
  for (const device of devices) {
    addNode(config.nodeTypes.device, nodeId('device', device.deviceId), device);
  }

  // -- transactions, their edges, and the ips/devices they reference -----
  for (const txn of transactions) {
    const customerNode = nodeId('customer', txn.customerId);
    const txnNode = nodeId('transaction', txn.transactionId);

    addNode(config.nodeTypes.transaction, txnNode, txn);
    addEdge(customerNode, txnNode, config.edgeTypes.customerTransaction, {
      orderId: txn.orderId,
      ip: txn.ipAddress,
      deviceId: txn.deviceId,
    });

    if (txn.deviceId) {
      const deviceNode = nodeId('device', txn.deviceId);
      addNode(config.nodeTypes.device, deviceNode, null);
      addEdge(txnNode, deviceNode, config.edgeTypes.transactionDevice);
      addEdge(customerNode, deviceNode, config.edgeTypes.customerDevice, {
        transactionId: txn.transactionId,
      });
    }

    if (txn.ipAddress) {
      const ipNode = nodeId('ip', txn.ipAddress);
      addNode(config.nodeTypes.ip, ipNode, null);
      addEdge(customerNode, ipNode, config.edgeTypes.customerIp, {
        transactionId: txn.transactionId,
      });
    }
  }

  // -- refunds -----------------------------------------------------------
  for (const refund of refunds) {
    const refundNode = nodeId('refund', refund.refundId);
    addNode(config.nodeTypes.refund, refundNode, refund);

    const txnNode = nodeId('transaction', refund.transactionId);
    // Only link if the transaction exists in the graph (dataset-consistent).
    if (nodes.has(txnNode)) {
      addEdge(txnNode, refundNode, config.edgeTypes.transactionRefund);
    }
  }

  // -- complaints ---------------------------------------------------------
  for (const complaint of complaints) {
    const complaintNode = nodeId('complaint', complaint.complaintId);
    addNode(config.nodeTypes.complaint, complaintNode, complaint);

    const customerNode = nodeId('customer', complaint.customerId);
    if (nodes.has(customerNode)) {
      addEdge(customerNode, complaintNode, config.edgeTypes.customerComplaint);
    }

    if (complaint.refundId) {
      const refundNode = nodeId('refund', complaint.refundId);
      if (nodes.has(refundNode)) {
        addEdge(complaintNode, refundNode, config.edgeTypes.complaintRefund);
      }
    }
  }

  // Stable ordering: sort edges so output is independent of input array order.
  edges.sort((a, b) => (a.from + a.to + a.type < b.from + b.to + b.type ? -1 : 1));

  // -- adjacency -----------------------------------------------------------
  const adjacency = new Map();
  for (const node of nodes.values()) adjacency.set(node.id, []);
  for (const edge of edges) {
    const list = adjacency.get(edge.from);
    if (list && !list.includes(edge.to)) list.push(edge.to);
    const reverse = adjacency.get(edge.to);
    if (reverse && !reverse.includes(edge.from)) reverse.push(edge.from);
  }
  for (const neighbors of adjacency.values()) neighbors.sort();

  const typeCount = (t) => {
    let n = 0;
    for (const node of nodes.values()) if (node.type === t) n += 1;
    return n;
  };

  const stats = {
    customerNodes: typeCount('customer'),
    deviceNodes: typeCount('device'),
    ipNodes: typeCount('ip'),
    transactionNodes: typeCount('transaction'),
    refundNodes: typeCount('refund'),
    complaintNodes: typeCount('complaint'),
    edgeCount: edges.length,
  };

  return { nodes, edges, adjacency, stats };
}

module.exports = { buildGraph, nodeId };