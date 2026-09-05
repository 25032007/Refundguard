/**
 * Small deterministic fixtures shared by signal tests.
 */

const CUSTOMER_ID = 'cust_test';

function makeRefund(overrides = {}) {
  return {
    refundId: 'ref_00001',
    transactionId: 'txn_00001',
    customerId: CUSTOMER_ID,
    orderId: 'ord_00001',
    amount: 100,
    reason: 'item_not_received',
    status: 'processed',
    requestedAt: '2025-09-01T00:00:00.000Z',
    processedAt: '2025-09-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeTransaction(overrides = {}) {
  return {
    transactionId: 'txn_00001',
    customerId: CUSTOMER_ID,
    orderId: 'ord_00001',
    amount: 100,
    currency: 'INR',
    paymentMethod: 'card',
    deviceId: 'dev_00001',
    ipAddress: '10.0.0.1',
    status: 'completed',
    createdAt: '2025-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBase({ transactions = [], refunds = [], customer = null } = {}) {
  return {
    customer: customer || { customerId: CUSTOMER_ID, name: 'Test Customer' },
    transactions,
    refunds,
    complaints: [],
    devices: [],
  };
}

function refundsOf(reason, count, options = {}) {
  const { startIso = '2025-09-01T00:00:00.000Z', dayStep = 1 } = options;
  const list = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.parse(startIso) + i * dayStep * 86400000).toISOString();
    list.push(makeRefund({ refundId: `ref_${i}`, transactionId: `txn_${i}`, reason, requestedAt: date }));
  }
  return list;
}

// Shared lookup builders mirroring risk-engine/buildContext behavior
function ipLookup(entries) {
  // entries: { ip, customers: [ids] }
  const map = new Map();
  for (const { ip, customers } of entries) {
    map.set(ip, new Set(customers));
  }
  return map;
}

function deviceLookup(entries) {
  // entries: { deviceId, customers: [ids] }
  const map = new Map();
  for (const { deviceId, customers } of entries) {
    map.set(deviceId, new Set(customers));
  }
  return map;
}

function ctx(overrides = {}) {
  return {
    ipCustomers: new Map(),
    deviceCustomers: new Map(),
    now: new Date('2025-09-05T00:00:00.000Z'),
    ...overrides,
  };
}

module.exports = { CUSTOMER_ID, makeRefund, makeTransaction, makeBase, refundsOf, ipLookup, deviceLookup, ctx };