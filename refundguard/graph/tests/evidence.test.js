/**
 * extractRingEvidence: observable facts only.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { buildGraph } = require('../buildGraph');
const { buildCustomerGraph, detectRingCandidates } = require('../detectRings');
const { findConnectedComponents } = require('../components');
const { extractRingEvidence } = require('../evidence');
const fixtures = require('./fixtures');

function analyze(dataset) {
  const graph = buildGraph(dataset);
  const customerGraph = buildCustomerGraph(graph);
  const components = findConnectedComponents(customerGraph);
  const candidates = detectRingCandidates(customerGraph, { components });
  return { graph, candidates };
}

test('shared IP evidence lists the IP and its customers', () => {
  const data = fixtures.ringOfThreeFull();
  const { graph, candidates } = analyze(data);
  const evidence = extractRingEvidence(candidates[0], graph);
  assert.strictEqual(evidence.sharedIps.length, 1);
  assert.strictEqual(evidence.sharedIps[0].ip, '88.1.1.1');
  assert.deepStrictEqual(evidence.sharedIps[0].customers, ['cust_a', 'cust_b', 'cust_c']);
});

test('shared device evidence lists the device and its customers', () => {
  const data = fixtures.ringOfThreeFull();
  const { graph, candidates } = analyze(data);
  const evidence = extractRingEvidence(candidates[0], graph);
  assert.strictEqual(evidence.sharedDevices.length, 1);
  assert.strictEqual(evidence.sharedDevices[0].deviceId, 'dev_shared');
  assert.deepStrictEqual(evidence.sharedDevices[0].customers, ['cust_a', 'cust_b', 'cust_c']);
});

test('refund evidence reports per-member and aggregate counts', () => {
  const data = {
    customers: [fixtures.customer('cust_a'), fixtures.customer('cust_b'), fixtures.customer('cust_c')],
    devices: [fixtures.device('dev_shared', 'cust_a')],
    transactions: [
      fixtures.txn('txn_a1', 'cust_a', { ip: '88.1.1.1', deviceId: 'dev_shared' }),
      fixtures.txn('txn_a2', 'cust_a', { ip: '88.1.1.1', deviceId: 'dev_shared' }),
      fixtures.txn('txn_b1', 'cust_b', { ip: '88.1.1.1', deviceId: 'dev_shared' }),
      fixtures.txn('txn_c1', 'cust_c', { ip: '88.1.1.1', deviceId: 'dev_shared' }),
    ],
    refunds: [
      fixtures.refund('ref_a1', 'txn_a1', 'cust_a'),
      fixtures.refund('ref_b1', 'txn_b1', 'cust_b'),
    ],
    complaints: [],
  };
  const { graph, candidates } = analyze(data);
  const evidence = extractRingEvidence(candidates[0], graph);
  assert.deepStrictEqual(evidence.refundCounts, { cust_a: 1, cust_b: 1, cust_c: 0 });
  assert.strictEqual(evidence.ringTransactions, 4);
  assert.strictEqual(evidence.ringRefunds, 2);
  assert.ok(Math.abs(evidence.ringRefundRate - 0.5) < 1e-9);
  assert.strictEqual(evidence.membersWithRefunds, 2);
});

test('complaint evidence reports per-member counts', () => {
  const data = fixtures.ringOfThreeFull();
  data.complaints = [
    fixtures.complaint('cmp_a1', 'cust_a'),
    fixtures.complaint('cmp_b1', 'cust_b'),
  ];
  const { graph, candidates } = analyze(data);
  const evidence = extractRingEvidence(candidates[0], graph);
  assert.deepStrictEqual(evidence.complaintCounts, { cust_a: 1, cust_b: 1, cust_c: 0 });
  assert.strictEqual(evidence.membersWithComplaints, 2);
});

test('no fabricated evidence for unrelated customers', () => {
  const data = fixtures.isolatedCustomer();
  const { graph } = analyze(data);
  // No candidate exists, but evidence should be empty and zeroed.
  const evidence = extractRingEvidence(
    { customerIds: ['cust_z'], memberCount: 1, relationshipEdges: [] },
    graph
  );
  assert.deepStrictEqual(evidence.sharedIps, []);
  assert.deepStrictEqual(evidence.sharedDevices, []);
  assert.deepStrictEqual(evidence.refundCounts, { cust_z: 0 });
  assert.deepStrictEqual(evidence.complaintCounts, { cust_z: 0 });
  assert.strictEqual(evidence.ringRefunds, 0);
  assert.strictEqual(evidence.ringRefundRate, 0);
});

test('evidence groups are deterministic (sorted) under shuffled datasets', () => {
  const data = fixtures.ringOfThreeFull();
  const { graph, candidates } = analyze(data);
  const evidence = extractRingEvidence(candidates[0], graph);

  const shuffled = {
    customers: [...data.customers].reverse(),
    devices: data.devices,
    transactions: [...data.transactions].reverse(),
    refunds: [],
    complaints: [],
  };
  const again = analyze(shuffled);
  const evidence2 = extractRingEvidence(again.candidates[0], again.graph);
  assert.deepStrictEqual(evidence, evidence2);
});