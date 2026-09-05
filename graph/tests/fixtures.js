/**
 * Small hand-built datasets + entity builders for the graph engine tests.
 * All timestamps are fixed strings so graphs are fully deterministic.
 */

const T = '2024-01-01T00:00:00.000Z';

function customer(id) {
  return {
    customerId: id,
    name: `Customer ${id}`,
    email: `${id}@example.com`,
    phone: '000-000-0000',
    status: 'active',
    createdAt: T,
  };
}

function device(id, ownerId) {
  return {
    deviceId: id,
    customerId: ownerId,
    deviceType: 'mobile',
    os: 'iOS',
    browser: 'Chrome',
    firstSeenAt: T,
    lastSeenAt: T,
  };
}

function txn(id, customerId, { ip = null, deviceId = null, orderId = null } = {}) {
  return {
    transactionId: id,
    customerId,
    orderId: orderId || `ord_${id}`,
    amount: 100,
    currency: 'INR',
    paymentMethod: 'card',
    deviceId,
    ipAddress: ip,
    status: 'completed',
    createdAt: T,
  };
}

function refund(id, transactionId, customerId) {
  return {
    refundId: id,
    transactionId,
    customerId,
    orderId: `ord_${transactionId}`,
    amount: 100,
    reason: 'other',
    status: 'processed',
    requestedAt: T,
    processedAt: T,
  };
}

function complaint(id, customerId, text = 'There was an issue with my order.') {
  return {
    complaintId: id,
    customerId,
    orderId: `ord_${id}`,
    refundId: null,
    text,
    category: 'other',
    status: 'open',
    createdAt: T,
  };
}

/** Dataset with two customers sharing one IP. */
function twoCustomersOneIp() {
  const customers = [customer('cust_a'), customer('cust_b')];
  const devices = [device('dev_a', 'cust_a'), device('dev_b', 'cust_b')];
  const transactions = [
    txn('txn_a1', 'cust_a', { ip: '99.1.1.1', deviceId: 'dev_a' }),
    txn('txn_b1', 'cust_b', { ip: '99.1.1.1', deviceId: 'dev_b' }),
  ];
  return { customers, devices, transactions, refunds: [], complaints: [] };
}

/** Dense 3-member ring: everyone shares an IP and a device. */
function ringOfThreeFull() {
  const customers = [customer('cust_a'), customer('cust_b'), customer('cust_c')];
  const devices = [device('dev_shared', 'cust_a')];
  const transactions = [0, 1, 2].map((i) =>
    txn(`txn_a${i}`, `cust_${['a', 'b', 'c'][i]}`, { ip: '88.1.1.1', deviceId: 'dev_shared' })
  );
  return { customers, devices, transactions, refunds: [], complaints: [] };
}

/** Chain 3-member ring: only two shared-IP pairs (A-B and B-C). */
function ringOfThreeChain() {
  const customers = [customer('cust_a'), customer('cust_b'), customer('cust_c')];
  const devices = [device('dev_a', 'cust_a'), device('dev_b', 'cust_b'), device('dev_c', 'cust_c')];
  const transactions = [
    txn('txn_a1', 'cust_a', { ip: '88.1.1.1', deviceId: 'dev_a' }),
    txn('txn_b1', 'cust_b', { ip: '88.1.1.1', deviceId: 'dev_b' }),
    txn('txn_b2', 'cust_b', { ip: '88.1.1.2', deviceId: 'dev_b' }),
    txn('txn_c1', 'cust_c', { ip: '88.1.1.2', deviceId: 'dev_c' }),
  ];
  return { customers, devices, transactions, refunds: [], complaints: [] };
}

/** A single isolated customer. */
function isolatedCustomer() {
  const customers = [customer('cust_z')];
  const devices = [device('dev_z', 'cust_z')];
  const transactions = [txn('txn_z1', 'cust_z', { ip: '77.1.1.1', deviceId: 'dev_z' })];
  return { customers, devices, transactions, refunds: [], complaints: [] };
}

module.exports = {
  customer,
  device,
  txn,
  refund,
  complaint,
  twoCustomersOneIp,
  ringOfThreeFull,
  ringOfThreeChain,
  isolatedCustomer,
};