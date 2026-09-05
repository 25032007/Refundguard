/**
 * RefundGuard Risk Engine CLI runner.
 *
 * Loads the generated dataset from data/raw/*.json, runs the risk engine over
 * every customer, prints the score distribution, the top-risk customers with
 * full explainability output, and (using the generator's clusters.json ground
 * truth) a validation-only comparison of suspicious vs normal customers.
 *
 * The ground-truth clusters file is used ONLY for this report — it is never
 * fed into the engine itself.
 *
 * Usage:  node risk-engine/run.js
 */

const fs = require('fs');
const path = require('path');
const engine = require('./index');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

function load(name) {
  const file = path.join(RAW_DIR, name);
  if (!fs.existsSync(file)) {
    console.error(`[run] Missing file: ${name}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadGroundTruth() {
  const file = path.join(RAW_DIR, 'clusters.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function printExplainability(result) {
  console.log(result.customerId);
  console.log(`Score: ${result.score}`);
  console.log(`Level: ${result.level}`);
  console.log('');
  console.log('Signals:');
  if (result.signals.length === 0) {
    console.log('  [INFO] No signals triggered.');
  }
  for (const s of result.signals) {
    console.log(`[${s.severity.toUpperCase()}] ${s.type.replace(/_/g, ' ')}`);
    const detail = detailLine(s);
    console.log(`      ${detail}`);
    console.log(`      +${s.contribution}`);
  }
  console.log('---------------------------------');
}

function detailLine(signal) {
  const e = signal.evidence;
  switch (signal.type) {
    case 'refund_frequency':
      return `${e.refundCount} refund${e.refundCount === 1 ? '' : 's'} in observed period`;
    case 'refund_rate': {
      const pct = Math.round(e.refundRate * 100);
      return `${e.refundCount} / ${e.completedTransactionCount} completed transactions (${pct}%)`;
    }
    case 'refund_velocity':
      return `${e.recentRefundCount} refund request${e.recentRefundCount === 1 ? '' : 's'} within ${e.windowDays} days`;
    case 'repeated_refund_reason':
      return `${e.reason} — ${Math.round(e.percentage * 100)}% of refunds`;
    case 'shared_ip':
      return `Shared with ${e.linkedCustomerCount} other customer${e.linkedCustomerCount === 1 ? '' : 's'} (${e.sharedIp})`;
    case 'shared_device':
      return `Shared with ${e.linkedCustomerCount} other customer${e.linkedCustomerCount === 1 ? '' : 's'} (${e.deviceId})`;
    default:
      return JSON.stringify(signal.evidence);
  }
}

function main() {
  const dataset = {
    customers: load('customers.json'),
    orders: load('orders.json'),
    devices: load('devices.json'),
    transactions: load('transactions.json'),
    refunds: load('refunds.json'),
    complaints: load('complaints.json'),
  };

  const results = engine.analyzeAllCustomers(dataset);
  const summary = engine.summarize(results);
  const groundTruth = loadGroundTruth();

  console.log('RefundGuard Risk Engine');
  console.log('=======================');
  console.log('');
  console.log(`Customers analyzed: ${summary.count}`);
  console.log('');
  console.log(`Average score: ${summary.average.toFixed(1)}`);
  console.log('');
  console.log('Risk distribution:');
  console.log(`  Critical: ${summary.distribution.critical || 0}`);
  console.log(`  High: ${summary.distribution.high || 0}`);
  console.log(`  Medium: ${summary.distribution.medium || 0}`);
  console.log(`  Low: ${summary.distribution.low || 0}`);
  console.log('');

  const top = results.slice(0, 10);
  console.log('Top 10 customers:');
  top.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.customerId} — ${r.score} — ${r.level}`);
  });

  if (groundTruth) {
    const suspiciousIds = new Set();
    for (const cluster of groundTruth) {
      for (const member of cluster.members) suspiciousIds.add(member);
    }
    const suspicious = results.filter((r) => suspiciousIds.has(r.customerId));
    const normal = results.filter((r) => !suspiciousIds.has(r.customerId));
    const avg = (list) => (list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0);
    const suspiciousAvg = avg(suspicious);
    const normalAvg = avg(normal);
    const topIds = new Set(results.slice(0, 10).map((r) => r.customerId));
    const suspiciousInTop = suspicious.filter((r) => topIds.has(r.customerId)).length;

    console.log('');
    console.log('Ground-truth validation (generator clusters — report only,');
    console.log('never used by the engine):');
    console.log(`  Suspicious-cluster customers: ${suspicious.length}`);
    console.log(`  Normal customers: ${normal.length}`);
    console.log(`  Suspicious-cluster average score: ${suspiciousAvg.toFixed(1)}`);
    console.log(`  Normal-customer average score: ${normalAvg.toFixed(1)}`);
    console.log(`  Suspicious customers in top 10: ${suspiciousInTop}`);
  }

  console.log('');
  console.log('Explainability — top 5 risk customers:');
  console.log('--------------------------------------');
  for (const result of results.slice(0, 5)) {
    printExplainability(result);
  }
}

main();