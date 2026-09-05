/**
 * detectRingCandidates: ring candidate selection + guard test.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { buildGraph } = require('../buildGraph');
const { buildCustomerGraph, detectRingCandidates } = require('../detectRings');
const { findConnectedComponents } = require('../components');
const config = require('../config');
const fixtures = require('./fixtures');

function candidatesOf(dataset, options) {
  const graph = buildGraph(dataset);
  const customerGraph = buildCustomerGraph(graph);
  const components = findConnectedComponents(customerGraph);
  return detectRingCandidates(customerGraph, { components, ...options });
}

test('a 2-member component is ignored (below minimumMembers)', () => {
  const candidates = candidatesOf(fixtures.twoCustomersOneIp());
  assert.strictEqual(candidates.length, 0);
});

test('a valid 3-member ring is detected with deterministic ID', () => {
  const candidates = candidatesOf(fixtures.ringOfThreeFull());
  assert.strictEqual(candidates.length, 1);
  const ring = candidates[0];
  assert.strictEqual(ring.ringId, 'ring_cust_a');
  assert.strictEqual(ring.memberCount, 3);
  assert.deepStrictEqual(ring.customerIds, ['cust_a', 'cust_b', 'cust_c']);
  // combined relationship types are preserved, not collapsed
  assert.deepStrictEqual(ring.relationshipTypes, ['shared_device', 'shared_ip']);
});

test('density counts unique customer pairs, not per-type edges', () => {
  const [ring] = candidatesOf(fixtures.ringOfThreeFull());
  // 3 IP edges + 3 device edges = 6 typed edges, but only 3 unique pairs.
  assert.strictEqual(ring.relationshipEdges.length, 6);
  assert.strictEqual(ring.density, 1);
});

test('a chained component (2 of 3 pairs) has density 2/3, not 1', () => {
  const [ring] = candidatesOf(fixtures.ringOfThreeChain());
  assert.strictEqual(ring.memberCount, 3);
  assert.ok(Math.abs(ring.density - 2 / 3) < 1e-9);
});

test('minimum relationship edges config is honored', () => {
  // Chain has exactly 2 relationship edges; raising the floor drops it.
  const candidates = candidatesOf(fixtures.ringOfThreeChain(), { minimumRelationshipEdges: 3 });
  assert.strictEqual(candidates.length, 0);
});

test('weak single-relationship structures do not auto-escalate (low score)', () => {
  const dataset = fixtures.ringOfThreeChain();
  const candidates = candidatesOf(dataset);
  assert.strictEqual(candidates.length, 1);
  // With no refunds/complaints the ring scores from IP + density only → low.
  const { scoreRing } = require('../scoreRing');
  const { extractRingEvidence } = require('../evidence');
  const graph = buildGraph(dataset);
  const scored = candidates.map((c) => scoreRing(c, extractRingEvidence(c, graph)));
  assert.strictEqual(scored[0].score, 20);
  assert.strictEqual(scored[0].severity, 'low');
});

test('ring candidates sort deterministically (memberCount desc, id asc)', () => {
  // Two separate rings + one isolated customer in one dataset.
  const a = fixtures.twoCustomersOneIp(); // cust_a, cust_b (2 members -> not a candidate)
  const big = fixtures.ringOfThreeFull(); // cust_a..c again -> would merge with the pair
  const data = {
    customers: [
      fixtures.customer('ring1_x'),
      fixtures.customer('ring1_y'),
      fixtures.customer('ring1_z'),
      fixtures.customer('ring2_p'),
      fixtures.customer('ring2_q'),
      fixtures.customer('ring2_r'),
    ],
    devices: [],
    transactions: [
      fixtures.txn('t_1x', 'ring1_x', { ip: '10.0.0.1', deviceId: 'dev_r1' }),
      fixtures.txn('t_1y', 'ring1_y', { ip: '10.0.0.1', deviceId: 'dev_r1' }),
      fixtures.txn('t_1z', 'ring1_z', { ip: '10.0.0.1', deviceId: 'dev_r1' }),
      fixtures.txn('t_2p', 'ring2_p', { ip: '10.0.0.2', deviceId: 'dev_r2' }),
      fixtures.txn('t_2q', 'ring2_q', { ip: '10.0.0.2', deviceId: 'dev_r2' }),
      fixtures.txn('t_2r', 'ring2_r', { ip: '10.0.0.2', deviceId: 'dev_r2' }),
    ],
    refunds: [],
    complaints: [],
  };
  const candidates = candidatesOf(data);
  assert.strictEqual(candidates.length, 2);
  assert.deepStrictEqual(candidates.map((c) => c.ringId), ['ring_ring1_x', 'ring_ring2_p']);
  assert.deepStrictEqual(candidates[0].customerIds, ['ring1_x', 'ring1_y', 'ring1_z']);
});

test('ring ids are deterministic regardless of input order', () => {
  const base = fixtures.ringOfThreeFull();
  const shuffled = {
    customers: [...base.customers].reverse(),
    devices: base.devices,
    transactions: [...base.transactions].reverse(),
    refunds: [],
    complaints: [],
  };
  assert.strictEqual(candidatesOf(base)[0].ringId, candidatesOf(shuffled)[0].ringId);
});

// -------------------------------------------------------------------- GUARD
test('core graph modules do not reference clusters.json or nondeterminism', () => {
  const modules = ['config.js', 'buildGraph.js', 'components.js', 'detectRings.js', 'evidence.js', 'scoreRing.js', 'index.js'];
  const graphDir = path.join(__dirname, '..');
  for (const file of modules) {
    const source = fs.readFileSync(path.join(graphDir, file), 'utf8');
    assert.ok(!source.includes('clusters.json'), `${file} must not reference clusters.json`);
    for (const forbidden of ['Math.random', 'Date.now', 'crypto.randomUUID']) {
      assert.ok(!source.includes(forbidden), `${file} must not use ${forbidden}`);
    }
  }
});

test('shared-transaction-context is off by default (order reuse creates no edge)', () => {
  const data = {
    customers: [fixtures.customer('cust_a'), fixtures.customer('cust_b')],
    devices: [fixtures.device('dev_a', 'cust_a'), fixtures.device('dev_b', 'cust_b')],
    transactions: [
      fixtures.txn('txn_a1', 'cust_a', { orderId: 'ord_shared' }),
      fixtures.txn('txn_b1', 'cust_b', { orderId: 'ord_shared' }),
    ],
    refunds: [],
    complaints: [],
  };
  assert.strictEqual(config.includeSharedTransactionContext, false);
  const graph = buildGraph(data);
  const customerGraph = buildCustomerGraph(graph);
  assert.strictEqual(customerGraph.edges.length, 0);
});