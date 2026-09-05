/**
 * buildGraph: heterogeneous graph construction.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { buildGraph } = require('../buildGraph');
const fixtures = require('./fixtures');

test('correct node counts per type', () => {
  const { twoCustomersOneIp } = fixtures;
  const graph = buildGraph(twoCustomersOneIp());

  assert.strictEqual(graph.stats.customerNodes, 2);
  assert.strictEqual(graph.stats.transactionNodes, 2);
  assert.strictEqual(graph.stats.ipNodes, 1);
  assert.strictEqual(graph.stats.deviceNodes, 2);
  assert.strictEqual(graph.stats.refundNodes, 0);
  assert.strictEqual(graph.stats.complaintNodes, 0);
});

test('node ids use stable type prefixes', () => {
  const graph = buildGraph(fixtures.twoCustomersOneIp());
  let seen = {
    customer: 0,
    ip: 0,
    device: 0,
    transaction: 0,
  };
  for (const node of graph.nodes.values()) {
    assert.ok(node.id.startsWith(`${node.type}:`));
    seen[node.type] += 1;
  }
  assert.deepStrictEqual(seen, { customer: 2, ip: 1, device: 2, transaction: 2 });
});

test('customer -> transaction edges exist for every transaction', () => {
  const { twoCustomersOneIp } = fixtures;
  const data = twoCustomersOneIp();
  const graph = buildGraph(data);

  const ctEdges = graph.edges.filter((e) => e.type === 'customer_transaction');
  assert.strictEqual(ctEdges.length, data.transactions.length);
  for (const e of ctEdges) {
    assert.ok(e.from.startsWith('customer:cust_'));
    assert.ok(e.to.startsWith('transaction:txn_'));
  }
});

test('transaction -> refund edges exist for every refund', () => {
  const data = {
    customers: [fixtures.customer('cust_a')],
    devices: [fixtures.device('dev_a', 'cust_a')],
    transactions: [fixtures.txn('txn_a1', 'cust_a', { ip: '8.8.8.8', deviceId: 'dev_a' })],
    refunds: [fixtures.refund('ref_a1', 'txn_a1', 'cust_a')],
    complaints: [],
  };
  const graph = buildGraph(data);
  const trEdges = graph.edges.filter((e) => e.type === 'transaction_refund');
  assert.strictEqual(trEdges.length, 1);
  assert.strictEqual(trEdges[0].from, 'transaction:txn_a1');
  assert.strictEqual(trEdges[0].to, 'refund:ref_a1');
});

test('shared IP produces customer -> ip edges to the same ip node', () => {
  const graph = buildGraph(fixtures.twoCustomersOneIp());
  const ipEdges = graph.edges.filter((e) => e.type === 'customer_ip');
  assert.strictEqual(ipEdges.length, 2);
  assert.deepStrictEqual(new Set(ipEdges.map((e) => e.to)), new Set(['ip:99.1.1.1']));
});

test('shared device is represented through transaction deviceId usage', () => {
  const graph = buildGraph(fixtures.ringOfThreeFull());
  const cdEdges = graph.edges.filter((e) => e.type === 'customer_device');
  assert.strictEqual(cdEdges.length, 3);
  for (const e of cdEdges) assert.strictEqual(e.to, 'device:dev_shared');
});

test('graph construction is deterministic under shuffled input', () => {
  const base = fixtures.ringOfThreeFull();
  const shuffled = {
    customers: [...base.customers].reverse(),
    devices: [...base.devices].reverse(),
    transactions: [...base.transactions].reverse(),
    refunds: [],
    complaints: [],
  };

  const a = buildGraph(base);
  const b = buildGraph(shuffled);

  assert.deepStrictEqual(a.stats, b.stats);
  assert.deepStrictEqual(a.edges, b.edges);
  for (const [key, neighbors] of a.adjacency) {
    assert.deepStrictEqual(neighbors, b.adjacency.get(key));
  }
});

test('edge set matches supported edge types only', () => {
  const data = {
    customers: [fixtures.customer('cust_a')],
    devices: [fixtures.device('dev_a', 'cust_a')],
    transactions: [fixtures.txn('txn_a1', 'cust_a', { ip: '8.8.8.8', deviceId: 'dev_a' })],
    refunds: [fixtures.refund('ref_a1', 'txn_a1', 'cust_a')],
    complaints: [{ ...fixtures.complaint('cmp_a1', 'cust_a'), refundId: 'ref_a1' }],
  };
  const graph = buildGraph(data);
  const types = new Set(graph.edges.map((e) => e.type));
  assert.deepStrictEqual(
    [...types].sort(),
    [
      'complaint_refund',
      'customer_complaint',
      'customer_device',
      'customer_ip',
      'customer_transaction',
      'transaction_device',
      'transaction_refund',
    ]
  );
});