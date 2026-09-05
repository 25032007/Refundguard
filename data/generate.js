/**
 * RefundGuard deterministic synthetic data generator.
 *
 * Generates a reproducible dataset for local development and for seeding the
 * MongoDB collections. Uses a fixed @faker-js/faker seed so repeated runs
 * produce identical output (useful for testing the future risk engine).
 *
 * Outputs JSON files into data/raw/:
 *   customers.json, orders.json, devices.json, transactions.json,
 *   refunds.json, complaints.json
 *
 * The dataset contains a normal customer population plus 6 coordinated
 * suspicious clusters. Cluster members share signals — devices, IP
 * addresses, similar complaint wording, and repeated refund behavior — so the
 * future risk engine has meaningful structure to discover. NO risk score or
 * risk level is computed here.
 */

const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

const SEED = 20260905;

// Fixed reference timestamp so date generation never depends on Date.now().
// This keeps the faker RNG stream fully determined by SEED alone (Date.now()
// would otherwise vary `faker.date.between` range and desynchronize output).
const REF_TS = 1757042000000; // 2025-09-05T00:00:00Z (fixed)
const REF_DATE = new Date(REF_TS);

faker.seed(SEED);

const OUTPUT_DIR = path.join(__dirname, 'raw');

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------
const NORMAL_CUSTOMERS = 64;
const CLUSTERS = 6;
const CLUSTER_SIZE_MIN = 5;
const CLUSTER_SIZE_MAX = 7;

function makeId(prefix, n) {
  return `${prefix}_${String(n).padStart(5, '0')}`;
}

// ---------------------------------------------------------------
// Complaint wording templates
// ---------------------------------------------------------------
// Varied, natural-sounding complaints for normal customers.
const NORMAL_COMPLAINT_TEMPLATES = [
  'Received my order but the delivery was several days late and the package was left out.',
  'The product does not perform as described in the listing. Very disappointed.',
  'I was charged twice for a single order. Please look into the duplicate charge.',
  'The delivered item does not match the color I selected on the website.',
  'Customer service took too long to respond to my query about this order.',
  'The package arrived with the box crushed and one of the items missing.',
  'Order never reached my address even though it shows as delivered.',
  'I had trouble using the size and it is not suitable for my needs.',
  'The billing address on my receipt is incorrect. Can this be corrected?',
  'Shipping label was wrong and my order went to the wrong city.',
  'The quality of the fabric is much lower than expected for the price.',
  'Payment was processed but I never received a confirmation email.',
];

// Semantically similar complaints shared across members of a suspicious
// cluster. Wording varies per member but stays thematically consistent so a
// later NLP layer can detect similarity.
const CLUSTER_COMPLAINT_SET = [
  [
    'The package arrived damaged and I would like a refund for the full amount.',
    'The item was damaged when delivered. Please process my refund.',
    'The product arrived broken and I need a refund immediately.',
  ],
  [
    'I never received my order, the parcel was marked delivered but never came.',
    'My package was marked delivered but I got nothing. Needs a refund.',
    'The order was lost in delivery, no parcel arrived. Issuing refund please.',
  ],
  [
    'I requested a refund for the wrong item I received and it is still pending.',
    'Got the wrong product, my refund request has not been processed yet.',
    'The incorrect item was shipped to me and my refund is still stuck.',
  ],
  [
    'I was charged twice for the same order and need one charge refunded.',
    'Duplicate payment was taken from my account, need a refund back.',
    'My card was charged twice for a single order, refund the extra charge.',
  ],
  [
    'The product quality is poor and differs from the description. Full refund requested.',
    'Item quality does not match the listing, I want a complete refund.',
    'The quality is not what was advertised, refund the money please.',
  ],
  [
    'Repeated failed delivery attempts yet the order never arrived. Refund needed.',
    'Delivery failed multiple times and my order still has not come. Refund.',
    'My parcel was never delivered after several attempts. Please refund it.',
  ],
];

// Refund reasons concentrated per cluster (repeated refund behavior).
const CLUSTER_REFUND_REASONS = [
  ['damaged_item', 'damaged_item', 'quality_issue'],
  ['item_not_received', 'item_not_received', 'other'],
  ['wrong_item', 'wrong_item', 'quality_issue'],
  ['duplicate_payment', 'duplicate_payment', 'other'],
  ['quality_issue', 'quality_issue', 'damaged_item'],
  ['item_not_received', 'wrong_item', 'item_not_received'],
];

// ---------------------------------------------------------------
// Customers
// ---------------------------------------------------------------
function buildCustomers() {
  const customers = [];
  const clusterMembership = [];

  // Normal population
  for (let i = 0; i < NORMAL_CUSTOMERS; i++) {
    const id = makeId('cust', customers.length);
    const roll = faker.number.int({ min: 1, max: 100 });
    const status = roll <= 6 ? 'blocked' : roll <= 12 ? 'under_review' : 'active';
    customers.push({
      customerId: id,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number(),
      status,
      createdAt: faker.date.past({ years: 2, refDate: REF_DATE }).toISOString(),
    });
  }

  // Suspicious clusters
  for (let c = 0; c < CLUSTERS; c++) {
    const size = faker.number.int({ min: CLUSTER_SIZE_MIN, max: CLUSTER_SIZE_MAX });
    const members = [];
    for (let m = 0; m < size; m++) {
      const id = makeId('cust', customers.length);
      const status = faker.number.int({ min: 1, max: 100 }) <= 18 ? 'under_review' : 'active';
      customers.push({
        customerId: id,
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number(),
        status,
        createdAt: faker.date.past({ years: 1, refDate: REF_DATE }).toISOString(),
      });
      members.push(id);
    }
    clusterMembership.push(members);
  }

  return { customers, clusterMembership };
}

// ---------------------------------------------------------------
// Orders
// ---------------------------------------------------------------
function buildOrders(total) {
  const orders = [];
  for (let i = 0; i < total; i++) {
    orders.push({
      orderId: makeId('ord', i),
      amount: Number(faker.number.float({ min: 9, max: 1400, fractionDigits: 2 })),
      currency: 'INR',
    });
  }
  return orders;
}

// ---------------------------------------------------------------
// Devices
// ---------------------------------------------------------------
// Each suspicious cluster has a small set of SHARED devices. The shared device
// records are owned by one member, but members of a cluster reference those
// shared deviceIds from their transactions (transaction.deviceId), producing
// genuine cross-customer device sharing for the future graph.
function buildDevices(customers, clusterMembership) {
  const devices = [];
  const deviceIds = [];
  const clusterSharedDevices = [];
  const memberIds = clusterMembership.flat();
  const normalCustomers = customers.filter((c) => !memberIds.includes(c.customerId));

  for (const cust of normalCustomers) {
    const count = faker.number.int({ min: 1, max: 3 });
    for (let d = 0; d < count; d++) {
      const id = makeId('dev', devices.length);
      deviceIds.push(id);
      devices.push({
        deviceId: id,
        customerId: cust.customerId,
        deviceType: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
        os: faker.helpers.arrayElement(['iOS', 'Android', 'Windows', 'macOS', 'Linux']),
        browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge']),
        firstSeenAt: faker.date.past({ years: 2, refDate: REF_DATE }).toISOString(),
        lastSeenAt: faker.date.recent({ days: 30, refDate: REF_DATE }).toISOString(),
      });
    }
  }

  for (let c = 0; c < CLUSTERS; c++) {
    const members = clusterMembership[c];
    const shared = [];
    // 2 shared devices per cluster
    for (let s = 0; s < 2; s++) {
      const id = makeId('dev', devices.length);
      deviceIds.push(id);
      shared.push(id);
      devices.push({
        deviceId: id,
        customerId: members[0],
        deviceType: faker.helpers.arrayElement(['mobile', 'desktop']),
        os: faker.helpers.arrayElement(['iOS', 'Android']),
        browser: faker.helpers.arrayElement(['Chrome', 'Safari']),
        firstSeenAt: faker.date.past({ years: 1, refDate: REF_DATE }).toISOString(),
        lastSeenAt: faker.date.recent({ days: 30, refDate: REF_DATE }).toISOString(),
      });
    }
    // Each member also has a personal device
    for (let m = 0; m < members.length; m++) {
      const id = makeId('dev', devices.length);
      deviceIds.push(id);
      devices.push({
        deviceId: id,
        customerId: members[m],
        deviceType: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
        os: faker.helpers.arrayElement(['iOS', 'Android', 'Windows']),
        browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox']),
        firstSeenAt: faker.date.past({ years: 1, refDate: REF_DATE }).toISOString(),
        lastSeenAt: faker.date.recent({ days: 30, refDate: REF_DATE }).toISOString(),
      });
    }
    clusterSharedDevices.push(shared);
  }

  return { devices, deviceIds, clusterSharedDevices };
}

// ---------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------
function buildTransactions(customers, clusterMembership, orders, devicesResult) {
  const transactions = [];
  const { clusterSharedDevices } = devicesResult;
  const memberIds = clusterMembership.flat();

  // per-customer personal device lookup
  const customerDevices = {};
  for (const dev of devicesResult.devices) {
    (customerDevices[dev.customerId] = customerDevices[dev.customerId] || []).push(dev.deviceId);
  }

  const customerTxnMap = {}; // customerId -> [transaction]

  for (let i = 0; i < customers.length; i++) {
    const cust = customers[i];
    const count = faker.number.int({ min: 2, max: 8 });
    const list = [];
    for (let t = 0; t < count; t++) {
      const txn = {
        transactionId: makeId('txn', transactions.length),
        customerId: cust.customerId,
        orderId: faker.helpers.arrayElement(orderIdsPlaceholder),
        amount: Number(faker.number.float({ min: 9, max: 1400, fractionDigits: 2 })),
        currency: 'INR',
        paymentMethod: faker.helpers.arrayElement(['card', 'upi', 'netbanking', 'wallet']),
        deviceId: faker.helpers.arrayElement(customerDevices[cust.customerId] || []),
        ipAddress: null,
        status: faker.helpers.arrayElement(['completed', 'completed', 'completed', 'failed', 'cancelled']),
        createdAt: faker.date.past({ years: 1, refDate: REF_DATE }).toISOString(),
      };
      // Suspicious members: occasionally use a shared cluster device + shared IP
      const clusterIndex = memberIds.indexOf(cust.customerId);
      if (clusterIndex !== -1) {
        const clusterId = clusterMembership.findIndex((m) => m.includes(cust.customerId));
        const shared = clusterSharedDevices[clusterId];
        // ~40% of a suspicious member's transactions use a shared device
        if (faker.number.int({ min: 1, max: 100 }) <= 40) {
          txn.deviceId = faker.helpers.arrayElement(shared);
        }
        txn.ipAddress = clusterIps[clusterId];
      } else {
        txn.ipAddress = faker.internet.ipv4();
      }
      transactions.push(txn);
      list.push(txn);
    }
    customerTxnMap[cust.customerId] = list;
  }

  return { transactions, customerTxnMap };
}

// ---------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------
function buildRefunds(transactions, clusterMembership) {
  const refunds = [];
  const txnByCustomer = {};
  const memberIds = clusterMembership.flat();

  for (const t of transactions) {
    (txnByCustomer[t.customerId] = txnByCustomer[t.customerId] || []).push(t);
  }

  function makeRefund(txn, reason) {
    const requested = faker.date.recent({ days: 40, refDate: REF_DATE });
    const processed = faker.datatype.boolean()
      ? faker.date.between({ from: requested, to: REF_DATE })
      : null;
    return {
      refundId: makeId('ref', refunds.length),
      transactionId: txn.transactionId,
      customerId: txn.customerId,
      orderId: txn.orderId,
      amount: txn.amount,
      reason,
      status: faker.helpers.arrayElement(['requested', 'approved', 'processed', 'rejected']),
      requestedAt: requested.toISOString(),
      processedAt: processed ? processed.toISOString() : null,
    };
  }

  // Normal customers: limited refunds with varied reasons
  const REASONS = ['item_not_received', 'damaged_item', 'wrong_item', 'quality_issue', 'duplicate_payment', 'other'];
  for (const txn of transactions) {
    if (memberIds.includes(txn.customerId)) continue;
    if (faker.number.int({ min: 1, max: 100 }) > 40) continue;
    refunds.push(makeRefund(txn, faker.helpers.arrayElement(REASONS)));
  }

  // Suspicious clusters: frequent, repeated refunds
  for (let c = 0; c < CLUSTERS; c++) {
    const reasons = CLUSTER_REFUND_REASONS[c];
    for (const member of clusterMembership[c]) {
      const memberTxns = txnByCustomer[member] || [];
      for (const txn of memberTxns) {
        if (faker.number.int({ min: 1, max: 100 }) > 55) continue;
        refunds.push(makeRefund(txn, reasons[faker.number.int({ min: 0, max: reasons.length - 1 })]));
      }
    }
  }

  return refunds;
}

// ---------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------
function buildComplaints(customers, transactions, refunds, clusterMembership) {
  const complaints = [];
  const memberIds = clusterMembership.flat();
  const normalCustomers = customers.filter((c) => !memberIds.includes(c.customerId));

  for (const cust of normalCustomers) {
    const count = faker.number.int({ min: 0, max: 2 });
    const custTxns = transactions.filter((t) => t.customerId === cust.customerId);
    const linkedRefund = refunds.find((r) => r.customerId === cust.customerId);
    for (let i = 0; i < count; i++) {
      const txn = faker.helpers.arrayElement(custTxns);
      complaints.push({
        complaintId: makeId('comp', complaints.length),
        customerId: cust.customerId,
        orderId: txn.orderId,
        refundId: linkedRefund ? linkedRefund.refundId : null,
        text: faker.helpers.arrayElement(NORMAL_COMPLAINT_TEMPLATES),
        category: faker.helpers.arrayElement(['delivery', 'product', 'payment', 'refund', 'other']),
        status: faker.helpers.arrayElement(['open', 'resolved', 'escalated']),
        createdAt: faker.date.recent({ days: 60, refDate: REF_DATE }).toISOString(),
      });
    }
  }

  for (let c = 0; c < CLUSTERS; c++) {
    const templates = CLUSTER_COMPLAINT_SET[c];
    for (const member of clusterMembership[c]) {
      const memberRefunds = refunds.filter((r) => r.customerId === member);
      const memberTxns = transactions.filter((t) => t.customerId === member);
      const count = faker.number.int({ min: 2, max: 3 });
      for (let i = 0; i < count; i++) {
        const txn = faker.helpers.arrayElement(memberTxns);
        const linkedRefund = memberRefunds[i % Math.max(memberRefunds.length, 1)];
        complaints.push({
          complaintId: makeId('comp', complaints.length),
          customerId: member,
          orderId: txn.orderId,
          refundId: linkedRefund ? linkedRefund.refundId : null,
          text: templates[i % templates.length],
          category: 'refund',
          status: faker.helpers.arrayElement(['open', 'escalated']),
          createdAt: faker.date.recent({ days: 40, refDate: REF_DATE }).toISOString(),
        });
      }
    }
  }

  return complaints;
}

// Global state shared across build steps (assigned in main order)
let orderIdsPlaceholder = [];
let clusterIps = [];

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
function main() {
  const { customers, clusterMembership } = buildCustomers();
  const orders = buildOrders(720);
  orderIdsPlaceholder = orders.map((o) => o.orderId);

  const devicesResult = buildDevices(customers, clusterMembership);

  // Shared IP per cluster (used by suspicious members)
  clusterIps = clusterMembership.map(() => faker.internet.ipv4());

  const { transactions, customerTxnMap } = buildTransactions(
    customers,
    clusterMembership,
    orders,
    devicesResult
  );
  const refunds = buildRefunds(transactions, clusterMembership);
  const complaints = buildComplaints(customers, transactions, refunds, clusterMembership);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(path.join(OUTPUT_DIR, 'customers.json'), JSON.stringify(customers, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'orders.json'), JSON.stringify(orders, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'devices.json'), JSON.stringify(devicesResult.devices, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'transactions.json'), JSON.stringify(transactions, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'refunds.json'), JSON.stringify(refunds, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'complaints.json'), JSON.stringify(complaints, null, 2));

  // Ground-truth cluster membership. VALIDATION ONLY: the risk engine must
  // discover suspicious behavior from the actual records and must never read
  // this file. Keeping it lets validation tooling compare engine output
  // against the generator's intended clusters.
  const clusters = clusterMembership.map((members, i) => ({
    clusterId: `cluster_${String(i).padStart(2, '0')}`,
    members,
  }));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'clusters.json'), JSON.stringify(clusters, null, 2));

  console.log(`RefundGuard synthetic data generated (seed=${SEED})`);
  console.log('----------------------------------------------');
  console.log(`Customers: ${customers.length}`);
  console.log(`Orders: ${orders.length}`);
  console.log(`Devices: ${devicesResult.devices.length}`);
  console.log(`Transactions: ${transactions.length}`);
  console.log(`Refunds: ${refunds.length}`);
  console.log(`Complaints: ${complaints.length}`);
  console.log(`Suspicious clusters: ${clusterMembership.length}`);
  console.log(`Output written to data/raw/ (JSON, pretty-printed)`);
}

main();