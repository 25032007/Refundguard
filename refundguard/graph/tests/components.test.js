/**
 * findConnectedComponents over the customer graph.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { buildGraph } = require('../buildGraph');
const { buildCustomerGraph } = require('../detectRings');
const { findConnectedComponents } = require('../components');
const fixtures = require('./fixtures');

function componentsOf(dataset) {
  const graph = buildGraph(dataset);
  const customerGraph = buildCustomerGraph(graph);
  return findConnectedComponents(customerGraph);
}

test('records a simple connected component of shared-chip customers', () => {
  const comps = componentsOf(fixtures.twoCustomersOneIp());
  assert.deepStrictEqual(comps, [['cust_a', 'cust_b']]);
});

test('handles an isolated customer as a single-member component', () => {
  const dataset = {
    customers: [...fixtures.isolatedCustomer().customers],
    devices: [...fixtures.isolatedCustomer().devices],
    transactions: [...fixtures.isolatedCustomer().transactions],
    refunds: [],
    complaints: [],
  };
  const comps = componentsOf(dataset);
  assert.deepStrictEqual(comps, [['cust_z']]);
});

test('separates disconnected customers into multiple components', () => {
  const base = fixtures.isolatedCustomer();
  const data = {
    customers: [...fixtures.twoCustomersOneIp().customers, ...base.customers],
    devices: [...fixtures.twoCustomersOneIp().devices, ...base.devices],
    transactions: [...fixtures.twoCustomersOneIp().transactions, ...base.transactions],
    refunds: [],
    complaints: [],
  };
  const comps = componentsOf(data);
  // Two shared-IP customers first (size 2), then the isolated one.
  assert.strictEqual(comps.length, 2);
  assert.deepStrictEqual(comps[0], ['cust_a', 'cust_b']);
  assert.deepStrictEqual(comps[1], ['cust_z']);
});

test('component members are sorted ascending inside each component', () => {
  const comps = componentsOf(fixtures.ringOfThreeFull());
  assert.deepStrictEqual(comps[0], ['cust_a', 'cust_b', 'cust_c']);
});

test('components are deterministic under shuffled input order', () => {
  const base = fixtures.ringOfThreeFull();
  const a = componentsOf(base);
  const b = componentsOf({
    customers: [...base.customers].reverse(),
    devices: [...base.devices],
    transactions: [...base.transactions].reverse(),
    refunds: [],
    complaints: [],
  });
  assert.deepStrictEqual(a, b);
});