/**
 * Complaint NLP & Evidence Extraction — CLI runner.
 *
 * Loads data/raw/complaints.json, runs the deterministic NLP analysis, and
 * prints a bounded human-readable report. Ground-truth cluster membership
 * (data/raw/clusters.json) is used ONLY in the evaluation section below —
 * never to compute similarity, evidence, or NLP contribution.
 *
 * Usage:
 *   node nlp/run.js              # human-readable report
 *   node nlp/run.js --json       # deterministic JSON report on stdout
 */

const fs = require('fs');
const path = require('path');
const nlp = require('./index');
const { analyzeComplaints } = nlp;

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

function load(name) {
  const file = path.join(RAW_DIR, name);
  if (!fs.existsSync(file)) {
    console.error(`[nlp] Missing file: ${name}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadClusters() {
  try {
    return load('clusters.json');
  } catch {
    return null;
  }
}

function clip(text, max = 96) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function printTextReport(report, groundTruth) {
  console.log('RefundGuard Complaint NLP & Evidence Extraction');
  console.log('===============================================');
  console.log('');
  console.log(`Complaints analyzed: ${report.totalComplaints}`);
  console.log(`Customers with complaints: ${report.customersWithComplaints}`);
  console.log(`Similar complaint pairs (threshold ${nlp.config.similarity.threshold}): ${report.similarPairCount}`);
  console.log(`Repeated wording templates (>=${nlp.config.templates.minCount} uses): ${report.repeatedTemplateCount}`);
  console.log('');

  console.log('Strongest similar complaint pairs:');
  if (report.strongPairs.length === 0) {
    console.log('  (none above threshold)');
  }
  report.strongPairs.forEach((pair, i) => {
    console.log(`  ${i + 1}. ${pair.complaintIdA} <-> ${pair.complaintIdB}  sim=${pair.similarity.toFixed(2)}  shared=${pair.sharedTokenCount}`);
    console.log(`      shared tokens: ${pair.sharedTokens.join(', ')}`);
  });
  console.log('');

  console.log('Most reused complaint templates:');
  if (report.mostReusedTemplates.length === 0) {
    console.log('  (none above threshold)');
  }
  report.mostReusedTemplates.forEach((template, i) => {
    console.log(`  ${i + 1}. ${template.templateKey.slice(0, 70)}  (${template.count} complaints, ${template.customerIds.length} customers)`);
    console.log(`      example: "${clip(template.representativeText)}"`);
  });
  console.log('');

  console.log('Evidence-category distribution (complaints per category):');
  if (report.categoryDistribution.length === 0) {
    console.log('  (no categories matched)');
  }
  for (const entry of report.categoryDistribution) {
    console.log(`  ${entry.category}: ${entry.count}`);
  }

  const top = report.perCustomerResults.filter((r) => r.nlpContribution > 0).slice(0, 10);
  console.log('');
  console.log('Top customers by NLP contribution:');
  for (const [i, r] of top.entries()) {
    console.log(`  ${i + 1}. ${r.customerId}  contribution=${r.nlpContribution}/${nlp.config.nlp.maxContribution}  complaints=${r.complaintCount}`);
    for (const line of r.explanation) console.log(`       ${line}`);
  }

  if (groundTruth) {
    const suspiciousIds = new Set();
    for (const cluster of groundTruth) for (const member of cluster.members) suspiciousIds.add(member);

    const suspicious = report.perCustomerResults.filter((r) => suspiciousIds.has(r.customerId));
    const normal = report.perCustomerResults.filter((r) => !suspiciousIds.has(r.customerId));
    const avg = (list) => (list.length ? list.reduce((s, r) => s + r.nlpContribution, 0) / list.length : 0);
    const topIds = new Set(report.perCustomerResults.slice(0, 10).map((r) => r.customerId));
    const suspiciousInTop = suspicious.filter((r) => topIds.has(r.customerId)).length;

    console.log('');
    console.log('Ground-truth evaluation (evaluation only — generator clusters;');
    console.log('never used in the NLP analysis):');
    console.log(`  Suspicious-cluster average NLP contribution: ${avg(suspicious).toFixed(2)}`);
    console.log(`  Normal-customer average NLP contribution: ${avg(normal).toFixed(2)}`);
    console.log(`  Suspicious customers in top 10 NLP-risk: ${suspiciousInTop}`);
  }
}

function main() {
  const complaints = load('complaints.json');
  const report = analyzeComplaints(complaints);

  if (process.argv.includes('--json')) {
    const groundTruth = loadClusters();
    const suspiciousIds = groundTruth
      ? new Set(groundTruth.flatMap((cluster) => cluster.members))
      : null;
    const evaluation = {};
    if (suspiciousIds) {
      const suspicious = report.perCustomerResults.filter((r) => suspiciousIds.has(r.customerId));
      const normal = report.perCustomerResults.filter((r) => !suspiciousIds.has(r.customerId));
      const avg = (list) => (list.length ? list.reduce((s, r) => s + r.nlpContribution, 0) / list.length : 0);
      const topIds = new Set(report.perCustomerResults.slice(0, 10).map((r) => r.customerId));
      evaluation = {
        suspiciousClusterAverage: Number(avg(suspicious).toFixed(2)),
        normalAverage: Number(avg(normal).toFixed(2)),
        suspiciousInTop10: suspicious.filter((r) => topIds.has(r.customerId)).length,
      };
    }
    console.log(JSON.stringify({ ...report, evaluation }, null, 2));
    return;
  }

  printTextReport(report, loadClusters());
}

main();