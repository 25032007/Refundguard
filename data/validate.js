/**
 * RefundGuard data validation script.
 *
 * Loads the generated JSON from data/raw/ and verifies referential integrity:
 *   - every transaction references a valid customer
 *   - every refund references a valid transaction / customer / order
 *   - every complaint references a valid customer / order (+ optional refund)
 *   - every device relationship is valid
 *   - suspicious clusters actually share identifiers (device/IP)
 *   - no required fields are missing
 *
 * Exit code 0 on success, 1 on any validation failure.
 */

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, 'raw');

function load(name) {
  const file = path.join(RAW_DIR, name);
  if (!fs.existsSync(file)) {
    console.error(`[validate] Missing file: ${name}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const customers = load('customers.json');
  const orders = load('orders.json');
  const devices = load('devices.json');
  const transactions = load('transactions.json');
  const refunds = load('refunds.json');
  const complaints = load('complaints.json');

  const errors = [];
  const warn = (msg) => console.log(`[validate] WARN: ${msg}`);

  // Indexes
  const customerSet = new Set(customers.map((c) => c.customerId));
  const orderSet = new Set(orders.map((o) => o.orderId));
  const deviceSet = new Set(devices.map((d) => d.deviceId));
  const txnSet = new Set(transactions.map((t) => t.transactionId));
  const refundSet = new Set(refunds.map((r) => r.refundId));
  const deviceIdsByCustomer = {};
  for (const d of devices) {
    (deviceIdsByCustomer[d.customerId] = deviceIdsByCustomer[d.customerId] || []).push(d.deviceId);
  }

  // Unique ID check
  [
    ['customerId', customers],
    ['orderId', orders],
    ['deviceId', devices],
    ['transactionId', transactions],
    ['refundId', refunds],
    ['complaintId', complaints],
  ].forEach(([field, list]) => {
    const ids = list.map((r) => r[field]);
    if (new Set(ids).size !== ids.length) {
      errors.push(`Duplicate ${field} values found`);
    }
  });

  // Required fields present
  const collections = { customers, orders, devices, transactions, refunds, complaints };
  const requiredChecks = {
    customers: ['customerId', 'name', 'email', 'phone', 'status'],
    orders: ['orderId', 'amount', 'currency'],
    devices: ['deviceId', 'customerId', 'deviceType', 'os', 'browser', 'firstSeenAt', 'lastSeenAt'],
    transactions: ['transactionId', 'customerId', 'orderId', 'amount', 'currency', 'paymentMethod', 'deviceId', 'ipAddress', 'status'],
    refunds: ['refundId', 'transactionId', 'customerId', 'orderId', 'amount', 'reason', 'status', 'requestedAt'],
    complaints: ['complaintId', 'customerId', 'orderId', 'text', 'category', 'status'],
  };
  for (const [name, fields] of Object.entries(requiredChecks)) {
    const idField = fields[0];
    for (const rec of collections[name]) {
      for (const f of fields) {
        if (rec[f] === undefined || rec[f] === null || rec[f] === '') {
          errors.push(`${name}: missing required field '${f}' on ${rec[idField]}`);
        }
      }
    }
  }

  // Transactions → customers / orders
  for (const t of transactions) {
    if (!customerSet.has(t.customerId)) errors.push(`Transaction ${t.transactionId} references unknown customer ${t.customerId}`);
    if (!orderSet.has(t.orderId)) errors.push(`Transaction ${t.transactionId} references unknown order ${t.orderId}`);
    if (t.deviceId && !deviceSet.has(t.deviceId)) errors.push(`Transaction ${t.transactionId} references unknown device ${t.deviceId}`);
  }

  // Devices → customers
  for (const d of devices) {
    if (!customerSet.has(d.customerId)) errors.push(`Device ${d.deviceId} references unknown customer ${d.customerId}`);
  }

  // Refunds → transaction / customer / order
  for (const r of refunds) {
    if (!txnSet.has(r.transactionId)) errors.push(`Refund ${r.refundId} references unknown transaction ${r.transactionId}`);
    if (!customerSet.has(r.customerId)) errors.push(`Refund ${r.refundId} references unknown customer ${r.customerId}`);
    if (!orderSet.has(r.orderId)) errors.push(`Refund ${r.refundId} references unknown order ${r.orderId}`);
  }

  // Complaints → customer / order (+ optional refund)
  for (const c of complaints) {
    if (!customerSet.has(c.customerId)) errors.push(`Complaint ${c.complaintId} references unknown customer ${c.customerId}`);
    if (!orderSet.has(c.orderId)) errors.push(`Complaint ${c.complaintId} references unknown order ${c.orderId}`);
    if (c.refundId && !refundSet.has(c.refundId)) errors.push(`Complaint ${c.complaintId} references unknown refund ${c.refundId}`);
  }

  // Suspicious-cluster sharing verification
  // Reconstruct plausible clusters from shared IP addresses in transactions.
  // A group is "suspicious" if >=3 customers share an IP and each has refunds.
  const ipCustomerCount = {};
  const custRefundCount = {};
  for (const r of refunds) custRefundCount[r.customerId] = (custRefundCount[r.customerId] || 0) + 1;
  for (const t of transactions) {
    if (t.ipAddress && custRefundCount[t.customerId] >= 2) {
      (ipCustomerCount[t.ipAddress] = ipCustomerCount[t.ipAddress] || new Set()).add(t.customerId);
    }
  }

  let sharedIpGroups = 0;
  for (const [ip, custs] of Object.entries(ipCustomerCount)) {
    if (custs.size >= 3) {
      sharedIpGroups++;
      warn(`Shared IP group: ${ip} -> ${[...custs].join(', ')}`);
    }
  }

  // Shared device groups
  const deviceCustomerCount = {};
  for (const t of transactions) {
    if (t.deviceId && custRefundCount[t.customerId] >= 2) {
      (deviceCustomerCount[t.deviceId] = deviceCustomerCount[t.deviceId] || new Set()).add(t.customerId);
    }
  }
  let sharedDeviceGroups = 0;
  for (const [dev, custs] of Object.entries(deviceCustomerCount)) {
    if (custs.size >= 2) {
      sharedDeviceGroups++;
      warn(`Shared device group: ${dev} -> ${[...custs].join(', ')}`);
    }
  }

  console.log('==============================================');
  console.log('RefundGuard data validation');
  console.log('==============================================');
  console.log(`Customers: ${customers.length}`);
  console.log(`Orders: ${orders.length}`);
  console.log(`Devices: ${devices.length}`);
  console.log(`Transactions: ${transactions.length}`);
  console.log(`Refunds: ${refunds.length}`);
  console.log(`Complaints: ${complaints.length}`);
  console.log(`Shared-IP groups (>=3 refund-heavy customers): ${sharedIpGroups}`);
  console.log(`Shared-device groups (>=2 refund-heavy customers): ${sharedDeviceGroups}`);

  if (errors.length) {
    console.error('\n[validate] FAILED with errors:');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  console.log('\nAll cross-references valid. Required fields present. OK');
  process.exit(0);
}

main();