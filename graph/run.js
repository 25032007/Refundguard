/**
 * RefundGuard Graph Analysis — CLI.
 *
 * Loads the raw synthetic dataset, runs the full ring-detection pipeline, and
 * prints an investigation-style report. `--json` emits machine-readable JSON.
 *
 * The ONLY place in the graph engine that reads ground-truth clusters.json:
 * it is used strictly for evaluation/reporting and never influences graph
 * construction, component detection, ring detection, scoring, or evidence.
 */

const fs = require('fs');
const path = require('path');
const { analyzeRefundRings } = require('./index');
const config = require('./config');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, name), 'utf8'));
}

function loadDataset() {
  return {
    customers: loadJson('customers.json'),
    devices: loadJson('devices.json'),
    transactions: loadJson('transactions.json'),
    refunds: loadJson('refunds.json'),
    complaints: loadJson('complaints.json'),
  };
}

function groundTruthEvaluation(detectedRings) {
  const clusters = loadJson('clusters.json');
  const suspicious = new Set();
  for (const cluster of clusters) {
    for (const member of cluster.members) suspicious.add(member);
  }

  const ringMembers = [];
  for (const ring of detectedRings) ringMembers.push(...ring.customerIds);
  const covered = new Set(ringMembers);

  const suspiciousCovered = [...covered].filter((c) => suspicious.has(c)).length;
  const normalsIncluded = [...covered].filter((c) => !suspicious.has(c)).length;

  const ringOverlap = detectedRings
    .map((ring) => {
      let best = 0;
      let bestCluster = null;
      for (const cluster of clusters) {
        const overlap = ring.customerIds.filter((c) => cluster.members.includes(c)).length;
        if (overlap > best) {
          best = overlap;
          bestCluster = cluster.clusterId;
        }
      }
      return {
        ringId: ring.ringId,
        cluster: bestCluster,
        overlap: best,
        memberCount: ring.memberCount,
        cleanMatch: best === ring.memberCount,
      };
    })
    .sort((a, b) => b.overlap - a.overlap || (a.ringId < b.ringId ? -1 : 1));

  return {
    suspiciousMemberTotal: suspicious.size,
    suspiciousCovered,
    normalCustomerTotal: 100 - suspicious.size,
    normalsIncluded,
    ringOverlap,
  };
}

function printReport(result) {
  const stats = result.graphStats;
  const line = '='.repeat(26);

  console.log('RefundGuard Graph Analysis');
  console.log(line);
  console.log('');
  console.log('Graph:');
  console.log(`Customers: ${stats.customerNodes}`);
  console.log(`Devices: ${stats.deviceNodes}`);
  console.log(`IPs: ${stats.ipNodes}`);
  console.log(`Transactions: ${stats.transactionNodes}`);
  console.log(`Refunds: ${stats.refundNodes}`);
  console.log(`Complaints: ${stats.complaintNodes}`);
  console.log(`Edges: ${stats.edgeCount}`);
  console.log('');
  console.log(`Connected components: ${result.componentCount}`);
  console.log(`Ring candidates: ${result.candidateCount}`);
  console.log('');
  console.log('Top refund rings');
  console.log('-'.repeat(16));
  console.log('');

  const top = result.rings.slice(0, config.output.topRings);

  for (const ring of top) {
    console.log(`RING ${ring.ringId}`);
    console.log(`Severity: ${ring.severity.toUpperCase()}`);
    console.log(`Score: ${ring.score}`);
    console.log(`Members: ${ring.memberCount}`);
    console.log(`Relationship types: ${ring.relationshipTypes.join(', ')}`);
    console.log(`Density: ${ring.density.toFixed(3)}`);
    console.log('');
    console.log(`Members: ${ring.customerIds.join(', ')}`);
    console.log('');
    console.log('Evidence:');
    if (ring.evidence.sharedIps.length) {
      for (const g of ring.evidence.sharedIps) {
        console.log(`- Shared IP ${g.ip}: ${g.customers.join(', ')}`);
      }
    }
    if (ring.evidence.sharedDevices.length) {
      for (const g of ring.evidence.sharedDevices) {
        console.log(`- Shared device ${g.deviceId}: ${g.customers.join(', ')}`);
      }
    }
    console.log('');
    console.log('Behavior:');
    console.log(`- Transactions: ${ring.evidence.ringTransactions}, refunds: ${ring.evidence.ringRefunds} (rate ${(ring.evidence.ringRefundRate * 100).toFixed(0)}%)`);
    console.log(`- Members with refunds: ${ring.evidence.membersWithRefunds}/${ring.memberCount}`);
    console.log(`- Members with complaints: ${ring.evidence.membersWithComplaints}/${ring.memberCount}`);
    console.log('');
    console.log('Score breakdown:');
    for (const signal of ring.signals) {
      console.log(`- ${signal.type}: ${signal.contribution} (${signal.severity})`);
      if (signal.description) console.log(`    ${signal.description}`);
    }
    console.log('');
  }

  // -- ground-truth evaluation (honest, reporting only) -----------------
  const evalResult = groundTruthEvaluation(result.rings);
  console.log('Ground-truth evaluation');
  console.log('-'.repeat(24));
  console.log(`Suspicious-cluster members covered by detected rings: ${evalResult.suspiciousCovered} / ${evalResult.suspiciousMemberTotal}`);
  console.log(`Normal customers incorrectly included: ${evalResult.normalsIncluded} / ${evalResult.normalCustomerTotal}`);
  console.log('Top ring overlap:');
  for (const r of evalResult.ringOverlap.slice(0, config.output.topRings)) {
    console.log(`  ${r.ringId}: ${r.overlap}/${r.memberCount} members match ${r.cluster}${r.cleanMatch ? ' (exact)' : ''}`);
  }
}

function main() {
  const isJson = process.argv.includes('--json');
  const dataset = loadDataset();
  const result = analyzeRefundRings(dataset);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printReport(result);
}

main();