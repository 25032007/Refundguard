/**
 * Tests for dataset-level and per-customer complaint analysis, plus guards
 * ensuring the analysis source never reads ground-truth cluster definitions
 * and uses no nondeterministic primitives.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const nlp = require('../');
const { findRepeatedTemplates, analyzeCustomerComplaints, analyzeComplaints } = require('../analyze');

function complaint(id, customerId, text, extra = {}) {
  return { complaintId: id, customerId, orderId: 'ord_1', text, category: 'other', status: 'open', ...extra };
}

// ---------------------------------------------------------------- templates
test('repeated templates are detected from identical wording across customers', () => {
  const complaints = [
    complaint('comp_1', 'cust_a', 'The package arrived damaged and I need a refund.'),
    complaint('comp_2', 'cust_b', 'The package arrived damaged and I need a refund.'),
    complaint('comp_3', 'cust_c', 'The weather is nice today.'),
  ];
  const templates = findRepeatedTemplates(complaints);
  assert.strictEqual(templates.length, 1);
  assert.strictEqual(templates[0].count, 2);
  assert.deepStrictEqual(templates[0].customerIds, ['cust_a', 'cust_b']);
  assert.deepStrictEqual(templates[0].complaintIds, ['comp_1', 'comp_2']);
  assert.ok(templates[0].representativeText.length > 0);
  assert.ok(templates[0].templateKey.includes('refund'));
});

test('templates group near-duplicate wording via normalized token form, not exact strings', () => {
  // Same meaning, different punctuation and capitalization — token sets are
  // identical after normalization (stopword removal + lowercase).
  const complaints = [
    complaint('comp_1', 'cust_a', 'The package arrived damaged and I need a refund.'),
    complaint('comp_2', 'cust_b', 'the PACKAGE ARRIVED damaged AND i NEED a REFUND'),
  ];
  const templates = findRepeatedTemplates(complaints);
  assert.strictEqual(templates.length, 1);
  assert.strictEqual(templates[0].count, 2);
  assert.ok(templates[0].templateKey.includes('refund'));
});

test('templates respect minCount and are ordered by count desc', () => {
  const make = (id, text) => complaint(id, 'cust_' + id.replace('comp_', ''), text);
  const text1 = 'The package arrived damaged and I need a refund.';
  const text2 = 'The weather is nice today.';
  const complaints = [
    make('comp_1', text1), make('comp_2', text1), make('comp_3', text1),
    make('comp_4', text2), make('comp_5', text2),
  ];
  const templates = findRepeatedTemplates(complaints);
  assert.strictEqual(templates.length, 2);
  assert.strictEqual(templates[0].count, 3);
  assert.strictEqual(templates[1].count, 2);
});

// ---------------------------------------------------------------- customer aggregation
test('analyzeCustomerComplaints aggregates counts and evidence', () => {
  const complaints = [
    complaint('comp_1', 'cust_x', 'The package arrived damaged and I want a refund.'),
    complaint('comp_2', 'cust_y', 'The package arrived damaged and I want a refund.'),
    complaint('comp_3', 'cust_x', 'I never received my order.'),
  ];
  const result = analyzeCustomerComplaints('cust_x', complaints);
  assert.strictEqual(result.customerId, 'cust_x');
  assert.strictEqual(result.complaintCount, 2);
  assert.ok(result.evidence.categories.includes('refund_issue'));
  assert.strictEqual(result.similarComplaintCount, 1);
  assert.strictEqual(result.repeatedTemplateCount, 1);
  assert.ok(result.explanation.some((l) => l.includes('match')));
});

test('a customer with no matching complaints gets no contribution', () => {
  const complaints = [
    complaint('comp_1', 'cust_a', 'The weather is nice today.'),
    complaint('comp_2', 'cust_b', 'I enjoy reading books.'),
  ];
  const result = analyzeCustomerComplaints('cust_a', complaints);
  assert.strictEqual(result.nlpContribution, 0);
  assert.ok(result.explanation.some((l) => l.includes('No text-based similarity')));
});

// ---------------------------------------------------------------- contribution bounds
test('NLP contribution is bounded to the configured maximum', () => {
  // Build many cross-customer matches so the raw sum would exceed the cap.
  const complaints = [];
  for (let i = 0; i < 12; i++) {
    complaints.push(
      complaint(`comp_${i}_a`, `cust_a${i}`, 'The package arrived damaged and I need a refund immediately.'),
      complaint(`comp_${i}_b`, `cust_b${i}`, 'The package arrived damaged and I need a refund immediately.'),
      complaint(`comp_${i}_c`, `cust_c${i}`, 'I was charged twice for the same order.'),
      complaint(`comp_${i}_d`, `cust_d${i}`, 'I was charged twice for the same order.')
    );
  }
  const report = analyzeComplaints(complaints);
  assert.ok(report.perCustomerResults.length > 0);
  for (const r of report.perCustomerResults) {
    assert.ok(r.nlpContribution >= 0 && r.nlpContribution <= nlp.config.nlp.maxContribution);
  }
});

test('a reused-template-heavy customer scores higher than a lone customer', () => {
  const complaints = [
    complaint('c1', 'cust_a', 'The package arrived damaged and I need a refund.'),
    complaint('c2', 'cust_b', 'The package arrived damaged and I need a refund.'),
    complaint('c3', 'cust_c', 'I never received my order.'),
    complaint('c4', 'cust_lone', 'The weather is nice today.'),
  ];
  const report = analyzeComplaints(complaints);
  const reuse = report.perCustomerResults.find((r) => r.customerId === 'cust_a');
  const lone = report.perCustomerResults.find((r) => r.customerId === 'cust_lone');
  assert.ok(reuse.nlpContribution > lone.nlpContribution);
});

// ---------------------------------------------------------------- determinism & empty
test('dataset-level results order deterministically (contribution desc, then id asc)', () => {
  const complaints = [
    complaint('c1', 'cust_b', 'The package arrived damaged and I need a refund.'),
    complaint('c2', 'cust_a', 'The package arrived damaged and I need a refund.'),
    complaint('c3', 'cust_c', 'I never received my order.'),
  ];
  const a = analyzeComplaints(complaints);
  const b = analyzeComplaints([...complaints].reverse());
  assert.deepStrictEqual(a, b);
  const ids = a.perCustomerResults.map((r) => r.customerId);
  const sorted = [...ids].sort((x, y) => {
    const r = a.perCustomerResults;
    const sx = r.find((z) => z.customerId === x).nlpContribution;
    const sy = r.find((z) => z.customerId === y).nlpContribution;
    return sy - sx || (x < y ? -1 : 1);
  });
  assert.deepStrictEqual(ids, sorted);
});

test('analyzeComplaints handles an empty dataset', () => {
  const report = analyzeComplaints([]);
  assert.strictEqual(report.totalComplaints, 0);
  assert.strictEqual(report.customersWithComplaints, 0);
  assert.strictEqual(report.similarPairCount, 0);
  assert.strictEqual(report.repeatedTemplateCount, 0);
  assert.deepStrictEqual(report.strongPairs, []);
  assert.deepStrictEqual(report.mostReusedTemplates, []);
  assert.deepStrictEqual(report.categoryDistribution, []);
  assert.deepStrictEqual(report.perCustomerResults, []);
});

test('analyzeComplaints produces a complete structured report', () => {
  const complaints = [complaint('c1', 'cust_a', 'The package arrived damaged and I need a refund.')];
  const report = analyzeComplaints(complaints);
  assert.strictEqual(report.totalComplaints, 1);
  assert.strictEqual(report.customersWithComplaints, 1);
  assert.ok(Array.isArray(report.categoryDistribution));
  assert.ok(report.perCustomerResults[0].explanation.length > 0);
});

// ---------------------------------------------------------------- guards
test('NLP analysis source does not depend on ground-truth clusters.json', () => {
  const analysisFiles = ['index.js', 'analyze.js', 'similarity.js', 'evidence.js', 'normalize.js', 'config.js'];
  const nlpDir = path.join(__dirname, '..');
  for (const file of analysisFiles) {
    const source = fs.readFileSync(path.join(nlpDir, file), 'utf8');
    assert.ok(!source.includes('clusters.json'), `${file} must not reference clusters.json`);
  }
});

test('NLP analysis source contains no nondeterministic primitives', () => {
  const analysisFiles = ['index.js', 'analyze.js', 'similarity.js', 'evidence.js', 'normalize.js', 'config.js'];
  const nlpDir = path.join(__dirname, '..');
  for (const file of analysisFiles) {
    const source = fs.readFileSync(path.join(nlpDir, file), 'utf8');
    for (const forbidden of ['Math.random', 'Date.now', 'crypto.randomUUID']) {
      assert.ok(!source.includes(forbidden), `${file} must not use ${forbidden}`);
    }
  }
});