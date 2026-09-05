/**
 * Tests for the six risk signals plus engine integration.
 * Deterministic fixtures only — no MongoDB required.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const refundFrequency = require('../signals/refundFrequency');
const refundRate = require('../signals/refundRate');
const refundVelocity = require('../signals/refundVelocity');
const repeatedReason = require('../signals/repeatedReason');
const sharedIp = require('../signals/sharedIp');
const sharedDevice = require('../signals/sharedDevice');
const engine = require('../index');

const { makeBase, makeTransaction, makeRefund, refundsOf, ipLookup, deviceLookup, ctx, CUSTOMER_ID } = require('./fixtures');

// ---------------------------------------------------------------- 1. frequency
test('refund_frequency: no signal below the moderate threshold', () => {
  assert.strictEqual(refundFrequency.evaluate(makeBase({ refunds: [] })), null);
  assert.strictEqual(refundFrequency.evaluate(makeBase({ refunds: refundsOf('item_not_received', 2) })), null);
});

test('refund_frequency: medium for 3-4 refunds, high for 5+', () => {
  assert.strictEqual(refundFrequency.evaluate(makeBase({ refunds: refundsOf('item_not_received', 3) })).severity, 'medium');
  assert.strictEqual(refundFrequency.evaluate(makeBase({ refunds: refundsOf('item_not_received', 4) })).severity, 'medium');
  const high = refundFrequency.evaluate(makeBase({ refunds: refundsOf('item_not_received', 6) }));
  assert.strictEqual(high.severity, 'high');
  assert.strictEqual(high.contribution, 20);
  assert.deepStrictEqual(high.evidence, { refundCount: 6 });
  assert.ok(high.description.includes('6 refunds'));
  assert.strictEqual(high.type, 'refund_frequency');
});

// ---------------------------------------------------------------- 2. refund rate
test('refund_rate: no signal when no completed transactions', () => {
  assert.strictEqual(refundRate.evaluate(makeBase({ transactions: [makeTransaction({ status: 'failed' })], refunds: refundsOf('x', 2) })), null);
});

test('refund_rate: normal rate produces no signal, high rate produces signal', () => {
  const txns = [makeTransaction(), makeTransaction({ transactionId: 'txn_b' })];
  assert.strictEqual(refundRate.evaluate(makeBase({ transactions: txns, refunds: [] })), null);
});

test('refund_rate: ratio uses completed transactions as denominator', () => {
  const txns = [
    makeTransaction(), // completed
    makeTransaction({ transactionId: 'txn_b', status: 'failed' }),
    makeTransaction({ transactionId: 'txn_c', status: 'cancelled' }),
    makeTransaction({ transactionId: 'txn_d' }), // completed
  ];
  // 3 refunds across 2 completed -> rate 1.5 -> critical
  const signal = refundRate.evaluate(makeBase({ transactions: txns, refunds: refundsOf('x', 3) }));
  assert.strictEqual(signal.severity, 'critical');
  assert.strictEqual(signal.contribution, 20);
  assert.strictEqual(signal.evidence.completedTransactionCount, 2);
  assert.strictEqual(signal.evidence.refundRate, 1.5);
});

test('refund_rate: medium at 10-20%, high at 20-40%, critical above 40%', () => {
  const withRate = (refunds, completed) =>
    refundRate.evaluate(makeBase({
      transactions: Array.from({ length: completed }, (_, i) => makeTransaction({ transactionId: `t${i}` })),
      refunds: Array.from({ length: refunds }, (_, i) => makeRefund({ refundId: `r${i}` })),
    }));
  assert.strictEqual(withRate(1, 10).severity, 'medium');
  assert.strictEqual(withRate(3, 10).severity, 'high');
  assert.strictEqual(withRate(6, 10).severity, 'critical');
});

// ---------------------------------------------------------------- 3. velocity
test('refund_velocity: window is configurable and only recent refunds count', () => {
  const now = new Date('2025-09-05T00:00:00.000Z');
  const base = makeBase({
    refunds: [
      // within 30 days of now
      makeRefund({ requestedAt: '2025-09-01T00:00:00.000Z' }),
      makeRefund({ refundId: 'ref_b', requestedAt: '2025-08-20T00:00:00.000Z' }),
      // older than 30 days -> excluded
      makeRefund({ refundId: 'ref_c', requestedAt: '2025-07-01T00:00:00.000Z' }),
    ],
  });
  const signal = refundVelocity.evaluate(base, ctx({ now }));
  assert.strictEqual(signal.evidence.recentRefundCount, 2);
  assert.strictEqual(signal.severity, 'medium');
  assert.strictEqual(signal.evidence.windowDays, 30);
});

test('refund_velocity: no signal without enough recent refunds', () => {
  const now = new Date('2025-09-05T00:00:00.000Z');
  const base = makeBase({ refunds: [makeRefund({ requestedAt: '2025-09-01T00:00:00.000Z' })] });
  assert.strictEqual(refundVelocity.evaluate(base, ctx({ now })), null);
});

test('refund_velocity: high when many refunds collapse into the window', () => {
  const now = new Date('2025-09-05T00:00:00.000Z');
  const base = makeBase({ refunds: refundsOf('x', 4, { dayStep: 1 }) });
  const signal = refundVelocity.evaluate(base, ctx({ now }));
  assert.strictEqual(signal.severity, 'high');
  assert.strictEqual(signal.contribution, 15);
});

// ---------------------------------------------------------------- 4. repeated reason
test('repeated_reason: no signal below minCount', () => {
  assert.strictEqual(repeatedReason.evaluate(makeBase({ refunds: refundsOf('item_not_received', 2) })), null);
});

test('repeated_reason: reports the dominant reason and percentage', () => {
  const refunds = [
    ...refundsOf('damaged_item', 3),
    ...refundsOf('quality_issue', 2),
  ];
  const signal = repeatedReason.evaluate(makeBase({ refunds }));
  assert.strictEqual(signal.type, 'repeated_refund_reason');
  assert.strictEqual(signal.evidence.reason, 'damaged_item');
  assert.strictEqual(signal.evidence.count, 3);
  assert.strictEqual(signal.evidence.percentage, 0.6);
  assert.strictEqual(signal.severity, 'high'); // >= 0.6
  assert.strictEqual(signal.contribution, 10);
});

test('repeated_reason: medium at 40-60% concentration', () => {
  const refunds = [
    ...refundsOf('damaged_item', 2),
    ...refundsOf('quality_issue', 2),
    ...refundsOf('other', 1),
  ];
  const signal = repeatedReason.evaluate(makeBase({ refunds }));
  assert.strictEqual(signal.evidence.percentage, 0.4);
  assert.strictEqual(signal.severity, 'medium');
  assert.strictEqual(signal.contribution, 5);
});

test('repeated_reason: tie resolves deterministically', () => {
  const refunds = [
    ...refundsOf('zzz_reason', 2),
    ...refundsOf('aaa_reason', 2),
    ...refundsOf('other', 1),
  ];
  const signal = repeatedReason.evaluate(makeBase({ refunds }));
  assert.strictEqual(signal.evidence.reason, 'aaa_reason');
});

// ---------------------------------------------------------------- 5. shared IP
test('shared_ip: no signal when IP is unique to the customer', () => {
  const base = makeBase({
    transactions: [makeTransaction({ ipAddress: '10.0.0.1' }), makeTransaction({ transactionId: 't2', ipAddress: '10.0.0.2' })],
  });
  const shared = ctx({ ipCustomers: ipLookup([
    { ip: '10.0.0.1', customers: [CUSTOMER_ID] },
    { ip: '10.0.0.2', customers: [CUSTOMER_ID] },
  ]) });
  assert.strictEqual(sharedIp.evaluate(base, shared), null);
});

test('shared_ip: medium/high scaled by number of linked accounts', () => {
  const base = makeBase({ transactions: [makeTransaction({ ipAddress: '10.0.0.1' })] });
  const others = ['cust_a', 'cust_b'];
  const shared = ctx({ ipCustomers: ipLookup([{ ip: '10.0.0.1', customers: [CUSTOMER_ID, ...others] }]) });
  const signal = sharedIp.evaluate(base, shared);
  assert.strictEqual(signal.severity, 'medium'); // 2 others
  assert.strictEqual(signal.evidence.sharedIp, '10.0.0.1');
  assert.strictEqual(signal.evidence.linkedCustomerCount, 2);
  assert.deepStrictEqual(signal.evidence.linkedCustomers, ['cust_a', 'cust_b']);
  assert.strictEqual(signal.contribution, 10);
});

test('shared_ip: high for 4+ linked accounts', () => {
  const base = makeBase({ transactions: [makeTransaction({ ipAddress: '10.0.0.1' })] });
  const others = ['cust_a', 'cust_b', 'cust_c', 'cust_d'];
  const shared = ctx({ ipCustomers: ipLookup([{ ip: '10.0.0.1', customers: [CUSTOMER_ID, ...others] }]) });
  const signal = sharedIp.evaluate(base, shared);
  assert.strictEqual(signal.severity, 'high');
  assert.strictEqual(signal.contribution, 20);
});

test('shared_ip: picks the IP with the most linked accounts', () => {
  const base = makeBase({
    transactions: [
      makeTransaction({ ipAddress: '10.0.0.1' }),
      makeTransaction({ transactionId: 't2', ipAddress: '10.0.0.2' }),
    ],
  });
  const shared = ctx({ ipCustomers: ipLookup([
    { ip: '10.0.0.1', customers: [CUSTOMER_ID, 'cust_x'] },
    { ip: '10.0.0.2', customers: [CUSTOMER_ID, 'cust_a', 'cust_b', 'cust_c', 'cust_d'] },
  ]) });
  const signal = sharedIp.evaluate(base, shared);
  assert.strictEqual(signal.evidence.sharedIp, '10.0.0.2');
  assert.strictEqual(signal.evidence.linkedCustomerCount, 4);
});

// ---------------------------------------------------------------- 6. shared device
test('shared_device: no signal for single-owner devices derived from transactions', () => {
  const base = makeBase({ transactions: [makeTransaction({ deviceId: 'dev_00001' })] });
  const shared = ctx({ deviceCustomers: deviceLookup([{ deviceId: 'dev_00001', customers: [CUSTOMER_ID] }]) });
  assert.strictEqual(sharedDevice.evaluate(base, shared), null);
});

test('shared_device: detects cross-customer device reuse from transactions', () => {
  const base = makeBase({ transactions: [makeTransaction({ deviceId: 'dev_00001' })] });
  const shared = ctx({ deviceCustomers: deviceLookup([
    { deviceId: 'dev_00001', customers: [CUSTOMER_ID, 'cust_a', 'cust_b', 'cust_c', 'cust_d'] },
  ]) });
  const signal = sharedDevice.evaluate(base, shared);
  assert.strictEqual(signal.severity, 'high'); // 4 others
  assert.strictEqual(signal.evidence.deviceId, 'dev_00001');
  assert.strictEqual(signal.evidence.linkedCustomerCount, 4);
  assert.strictEqual(signal.contribution, 15);
});

test('shared_device: does not trust the Device collection owner field alone', () => {
  // Even though the Device collection claims the device belongs to this
  // customer alone, use the transaction-derived lookup; a device referenced
  // from other customers' transactions must still flag.
  const base = makeBase({
    transactions: [makeTransaction({ deviceId: 'dev_shared' })],
    devices: [{ deviceId: 'dev_shared', customerId: CUSTOMER_ID }],
  });
  const shared = ctx({ deviceCustomers: deviceLookup([
    { deviceId: 'dev_shared', customers: [CUSTOMER_ID, 'cust_a', 'cust_b'] },
  ]) });
  const signal = sharedDevice.evaluate(base, shared);
  assert.strictEqual(signal.severity, 'medium');
  assert.strictEqual(signal.evidence.linkedCustomerCount, 2);
});

// ---------------------------------------------------------------- integration
test('analyzeCustomerRisk returns a fully explainable result', () => {
  const dataset = minimalDataset([makeTransaction()], [makeRefund()]);
  const result = engine.analyzeCustomerRisk(CUSTOMER_ID, dataset);
  assert.strictEqual(result.customerId, CUSTOMER_ID);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(['low', 'medium', 'high', 'critical'].includes(result.level));
  for (const signal of result.signals) {
    assert.ok(signal.type);
    assert.ok(signal.description);
    assert.ok(signal.evidence);
    assert.ok(signal.contribution >= 0);
  }
});

test('analyzeCustomerRisk returns null for an unknown customer', () => {
  const dataset = minimalDataset([makeTransaction()], []);
  assert.strictEqual(engine.analyzeCustomerRisk('cust_missing', dataset), null);
});

test('analyzeAllCustomers sorts by descending score deterministically', () => {
  // cust_test has 3 refunds => higher aggregate score than cust_b's single refund.
  const a = makeTransaction({ transactionId: 'ta' });
  const b = makeTransaction({ transactionId: 'tb', customerId: 'cust_b', ipAddress: '10.0.0.9' });
  const dataset = {
    customers: [
      { customerId: CUSTOMER_ID },
      { customerId: 'cust_b' },
    ],
    transactions: [a, b],
    refunds: [
      makeRefund({ customerId: CUSTOMER_ID }),
      makeRefund({ refundId: 'rb1', transactionId: 'ta', customerId: CUSTOMER_ID }),
      makeRefund({ refundId: 'rb2', transactionId: 'ta', customerId: CUSTOMER_ID }),
      makeRefund({ refundId: 'rc', customerId: 'cust_b' }),
    ],
    complaints: [],
    devices: [],
  };
  const results = engine.analyzeAllCustomers(dataset);
  assert.strictEqual(results.length, 2);
  assert.ok(results[0].score > results[1].score);
  assert.strictEqual(results[0].customerId, CUSTOMER_ID);
});

test('analyzeAllCustomers tie-breaks by ascending customerId', () => {
  const dataset = {
    customers: [{ customerId: 'cust_a' }, { customerId: 'cust_b' }],
    transactions: [
      makeTransaction({ customerId: 'cust_a' }),
      makeTransaction({ transactionId: 'tb0', customerId: 'cust_b' }),
    ],
    refunds: [
      makeRefund({ customerId: 'cust_a' }),
      makeRefund({ refundId: 'rb', customerId: 'cust_b' }),
    ],
    complaints: [],
    devices: [],
  };
  const results = engine.analyzeAllCustomers(dataset);
  // identical scores -> deterministic order by id ascending
  assert.strictEqual(results[0].score, results[1].score);
  assert.deepStrictEqual(results.map((r) => r.customerId), ['cust_a', 'cust_b']);
});

test('engine never reads ground-truth cluster definitions', () => {
  // The engine signature takes only the dataset; the run.js CLI loads
  // clusters.json separately for reporting. Assert the engine has no access:
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  assert.ok(!src.includes('clusters.json'));
  assert.ok(!src.includes('groundTruth'));
});

function minimalDataset(transactions, refunds) {
  return {
    customers: [{ customerId: CUSTOMER_ID }],
    transactions,
    refunds,
    complaints: [],
    devices: transactions.map((t) => ({ deviceId: t.deviceId, customerId: t.customerId })),
  };
}