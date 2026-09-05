/**
 * scoreRing: deterministic, bounded, explainable ring scoring.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { buildGraph } = require('../buildGraph');
const { buildCustomerGraph, detectRingCandidates } = require('../detectRings');
const { findConnectedComponents } = require('../components');
const { extractRingEvidence } = require('../evidence');
const { scoreRing } = require('../scoreRing');
const config = require('../config');
const fixtures = require('./fixtures');

function scoreDataset(dataset) {
  const graph = buildGraph(dataset);
  const customerGraph = buildCustomerGraph(graph);
  const components = findConnectedComponents(customerGraph);
  const candidates = detectRingCandidates(customerGraph, { components });
  return candidates.map((candidate) => ({
    candidate,
    scored: scoreRing(candidate, extractRingEvidence(candidate, graph)),
  }));
}

test('score is bounded to 0-100 and equals the sum of contributions', () => {
  const dataset = fixtures.ringOfThreeFull();
  dataset.refunds = [
    fixtures.refund('ref_a1', 'txn_a0', 'cust_a'),
    fixtures.refund('ref_b1', 'txn_a1', 'cust_b'),
    fixtures.refund('ref_c1', 'txn_a2', 'cust_c'),
  ];
  dataset.complaints = [
    fixtures.complaint('cmp_a1', 'cust_a'),
    fixtures.complaint('cmp_b1', 'cust_b'),
    fixtures.complaint('cmp_c1', 'cust_c'),
  ];
  const [{ scored }] = scoreDataset(dataset);
  const sum = scored.signals.reduce((s, x) => s + x.contribution, 0);
  assert.strictEqual(scored.score, sum);
  assert.ok(scored.score >= 0 && scored.score <= 100);
});

test('severity bands partition the config range', () => {
  assert.deepStrictEqual(config.severity.map((b) => b.label), ['low', 'medium', 'high', 'critical']);
  assert.strictEqual(config.severity[0].max, 24);
  assert.strictEqual(config.severity[1].max, 49);
  assert.strictEqual(config.severity[2].max, 74);
  assert.strictEqual(config.severity[3].max, 100);
  assert.strictEqual(config.scoring.maxScore, 100);
});

test('a weak chained ring scores low; a dense full ring scores higher', () => {
  const weak = scoreDataset(fixtures.ringOfThreeChain());
  const strongBase = fixtures.ringOfThreeFull();
  strongBase.refunds = [
    fixtures.refund('ref_a1', 'txn_a0', 'cust_a'),
    fixtures.refund('ref_b1', 'txn_a1', 'cust_b'),
    fixtures.refund('ref_c1', 'txn_a2', 'cust_c'),
  ];
  strongBase.complaints = [
    fixtures.complaint('cmp_a1', 'cust_a'),
    fixtures.complaint('cmp_b1', 'cust_b'),
    fixtures.complaint('cmp_c1', 'cust_c'),
  ];
  const strong = scoreDataset(strongBase);

  assert.strictEqual(weak[0].scored.severity, 'low');
  assert.strictEqual(strong[0].scored.severity, 'critical');
  assert.ok(strong[0].scored.score > weak[0].scored.score);
});

test('stronger evidence (extra shared device) produces equal-or-higher score', () => {
  const base = fixtures.ringOfThreeChain();
  const single = scoreDataset(base);

  const plusDevice = {
    ...base,
    transactions: [
      ...base.transactions,
      fixtures.txn('txn_a3', 'cust_a', { ip: '88.9.9.9', deviceId: 'dev_shared2' }),
      fixtures.txn('txn_b3', 'cust_b', { ip: '88.9.9.9', deviceId: 'dev_shared2' }),
      fixtures.txn('txn_c3', 'cust_c', { ip: '88.9.9.9', deviceId: 'dev_shared2' }),
    ],
  };
  const dual = scoreDataset(plusDevice);

  assert.ok(dual[0].scored.score >= single[0].scored.score);
  const deviceContribution = (r) => r.scored.signals.find((s) => s.type === 'shared_device').contribution;
  assert.ok(deviceContribution(dual[0]) >= deviceContribution(single[0]));
});

test('a lone 13-member middle-stage signal never exceeds its budget', () => {
  const dataset = fixtures.ringOfThreeFull();
  const [{ scored }] = scoreDataset(dataset);
  const byType = {};
  for (const s of scored.signals) byType[s.type] = s.contribution;

  assert.ok(byType.shared_ip <= config.scoring.sharedIp, 'shared_ip within budget');
  assert.ok(byType.shared_device <= config.scoring.sharedDevice, 'shared_device within budget');
  assert.ok(byType.graph_density <= config.scoring.density, 'density within budget');
  assert.ok(byType.refund_concentration <= config.scoring.refundConcentration);
  assert.ok(byType.multi_member_refund_activity <= config.scoring.multiMemberRefundActivity);
  assert.ok(byType.complaint_concentration <= config.scoring.complaintConcentration);
});

test('scoring is deterministic', () => {
  const dataset = fixtures.ringOfThreeFull();
  const a = scoreDataset(dataset);
  const b = scoreDataset(dataset);
  assert.deepStrictEqual(a, b);
});

test('every contribution has a description and evidence reference', () => {
  const [{ scored }] = scoreDataset(fixtures.ringOfThreeFull());
  for (const signal of scored.signals) {
    assert.ok(typeof signal.description === 'string' && signal.description.length > 0);
    assert.ok(signal.evidence !== undefined);
  }
});