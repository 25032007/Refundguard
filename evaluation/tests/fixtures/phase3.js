/**
 * Hand-made examples for lead-time / group classification / recovery tests.
 * No UCI data required.
 */

/** Builds a tiny deterministic dataset (2 background legit customers + 2 scenarios). */
function makeTinyDataset() {
  const txn = (id, cid, ip, dev, ts) => ({
    transactionId: id,
    customerId: cid,
    orderId: `ord_${id}`,
    amount: 10,
    currency: 'GBP',
    paymentMethod: 'card',
    deviceId: dev,
    ipAddress: ip,
    status: 'completed',
    createdAt: new Date(ts).toISOString()
  });
  const refund = (id, txnId, cid, ts) => ({
    refundId: id,
    transactionId: txnId,
    customerId: cid,
    orderId: `ord_${txnId}`,
    amount: 10,
    reason: 'damaged',
    status: 'processed',
    requestedAt: new Date(ts).toISOString(),
    processedAt: new Date(ts).toISOString()
  });

  const cust = (id, createdAt) => ({ customerId: id, name: 'N', email: `${id}@ex.com`, phone: '0', status: 'active', createdAt: new Date(createdAt).toISOString() });
  const device = (id, cid) => ({ deviceId: id, customerId: cid, deviceType: 'mobile', os: 'iOS', browser: 'Chrome' });

  const customers = [cust('bg1', '2020-01-01T00:00:00Z'), cust('bg2', '2020-01-01T00:00:00Z')];
  const transactions = [];
  const refunds = [];
  const complaints = [];
  const devices = [device('dev_bg1', 'bg1'), device('dev_bg2', 'bg2')];

  // Scenario A: obvious ring, 3 members sharing IP '50.1.1.1' and same device.
  const aMembers = ['a1', 'a2', 'a3'];
  let j = 0;
  for (const cid of aMembers) {
    customers.push(cust(cid, '2020-02-01T00:00:00Z'));
    const t = new Date(Date.UTC(2020, 2, 10) + j * 86400000);
    transactions.push(txn(`ta${j}`, cid, '50.1.1.1', 'dev_ra', t.toISOString()));
    refunds.push(refund(`ra${j}`, `ta${j}`, cid, t.getTime() + 86400000));
    devices.push(device(`dev_ra_${j}`, cid));
    j++;
  }

  // Scenario B: noisy ring, 3 members each with a personal device, one shared ip.
  const bMembers = ['b1', 'b2', 'b3'];
  j = 0;
  for (const cid of bMembers) {
    customers.push(cust(cid, '2020-02-15T00:00:00Z'));
    const t = new Date(Date.UTC(2020, 2, 20) + j * 86400000);
    transactions.push(txn(`tb${j}`, cid, '60.1.1.1', `dev_b_${j}`, t.toISOString()));
    refunds.push(refund(`rb${j}`, `tb${j}`, cid, t.getTime() + 86400000));
    devices.push(device(`dev_b_${j}`, cid));
    j++;
  }

  const groundTruth = {
    seed: 1,
    customers: {
      bg1: { label: 'LEGITIMATE', categories: ['LEGITIMATE_NORMAL'], scenarioIds: [], memberJoinDate: null },
      bg2: { label: 'LEGITIMATE', categories: ['LEGITIMATE_HOUSEHOLD'], scenarioIds: [], memberJoinDate: null },
      a1: { label: 'FRAUD', categories: ['obvious_ring'], scenarioIds: ['s_a'], memberJoinDate: '2020-02-01T00:00:00Z' },
      a2: { label: 'FRAUD', categories: ['obvious_ring'], scenarioIds: ['s_a'], memberJoinDate: '2020-02-02T00:00:00Z' },
      a3: { label: 'FRAUD', categories: ['obvious_ring'], scenarioIds: ['s_a'], memberJoinDate: '2020-02-03T00:00:00Z' },
      b1: { label: 'FRAUD', categories: ['noisy_ring'], scenarioIds: ['s_b'], memberJoinDate: '2020-02-15T00:00:00Z' },
      b2: { label: 'FRAUD', categories: ['noisy_ring'], scenarioIds: ['s_b'], memberJoinDate: '2020-02-16T00:00:00Z' },
      b3: { label: 'FRAUD', categories: ['noisy_ring'], scenarioIds: ['s_b'], memberJoinDate: '2020-02-17T00:00:00Z' }
    },
    scenarios: [
      { scenarioId: 's_a', family: 'obvious_ring', members: aMembers },
      { scenarioId: 's_b', family: 'noisy_ring', members: bMembers },
      { scenarioId: 's_burst', family: 'burst_refund', members: ['x1', 'x2'] }
    ]
  };

  return { dataset: { customers, transactions, refunds, complaints, devices }, groundTruth };
}

module.exports = { makeTinyDataset };