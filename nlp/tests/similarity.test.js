/**
 * Tests for the deterministic lexical similarity engine.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { calculateSimilarity, findSimilarComplaints } = require('../similarity');

test('identical texts score 1.0 and report shared tokens', () => {
  const text = 'The package arrived damaged and I would like a refund for the full amount.';
  const result = calculateSimilarity(text, text);
  assert.strictEqual(result.score, 1);
  assert.ok(result.sharedTokenCount > 0);
  assert.strictEqual(result.sharedTokenCount, result.tokenCountA);
  assert.ok(result.sharedTokens.includes('refund'));
  assert.ok(result.sharedTokens.includes('damaged'));
});

test('unrelated texts score 0', () => {
  const result = calculateSimilarity('refund not received for my order', 'the weather is nice today outside');
  assert.strictEqual(result.score, 0);
  assert.strictEqual(result.sharedTokenCount, 0);
});

test('similar texts (near-duplicate narratives) score above the threshold', () => {
  const a = 'I was charged twice for a single order. Please look into the duplicate charge.';
  const b = 'My card was charged twice for a single order, refund the extra charge.';
  const result = calculateSimilarity(a, b);
  assert.ok(result.score >= 0.5, `expected >= 0.5, got ${result.score}`);
});

test('similarity is symmetric', () => {
  const a = 'The package arrived damaged and I need a refund.';
  const b = 'The parcel arrived damaged, please process my refund.';
  const forward = calculateSimilarity(a, b);
  const reverse = calculateSimilarity(b, a);
  assert.strictEqual(forward.score, reverse.score);
  assert.deepStrictEqual(forward.sharedTokens, reverse.sharedTokens);
});

test('shared tokens are reported sorted and deduplicated', () => {
  const a = 'refund damaged order refund';
  const b = 'refund broken order';
  const result = calculateSimilarity(a, b);
  assert.deepStrictEqual(result.sharedTokens, ['order', 'refund']);
});

test('empty-vs-empty comparison is 0, not NaN', () => {
  const result = calculateSimilarity('', '');
  assert.strictEqual(result.score, 0);
  assert.strictEqual(result.sharedTokenCount, 0);
});

// ----------------------------------------------------------- findSimilarComplaints
const baseComplaints = [
  { complaintId: 'comp_a', customerId: 'cust_1', text: 'The package arrived damaged and I need a refund.' },
  { complaintId: 'comp_b', customerId: 'cust_2', text: 'The package arrived damaged and I need a refund.' },
  { complaintId: 'comp_c', customerId: 'cust_3', text: 'The parcel arrived damaged, please process my refund.' },
  { complaintId: 'comp_d', customerId: 'cust_4', text: 'The weather is lovely today.' },
];

test('findSimilarComplaints returns cross pairs above threshold, no self pairs', () => {
  const pairs = findSimilarComplaints(baseComplaints, { threshold: 0.5 });
  assert.ok(pairs.length >= 2);
  for (const pair of pairs) {
    assert.notStrictEqual(pair.complaintIdA, pair.complaintIdB);
    assert.ok(pair.similarity >= 0.5);
    assert.ok(pair.complaintIdA < pair.complaintIdB, 'pairs are canonicalized A<B');
  }
});

test('findSimilarComplaints pairs are ordered deterministically (similarity desc)', () => {
  const pairs = findSimilarComplaints(baseComplaints, { threshold: 0 });
  for (let i = 1; i < pairs.length; i++) {
    assert.ok(pairs[i - 1].similarity >= pairs[i].similarity);
  }
});

test('findSimilarComplaints honors a custom threshold', () => {
  const low = findSimilarComplaints(baseComplaints, { threshold: 0 });
  const high = findSimilarComplaints(baseComplaints, { threshold: 0.99 });
  assert.ok(low.length > high.length);
  for (const pair of high) assert.strictEqual(pair.similarity, 1);
});

test('findSimilarComplaints reports shared tokens', () => {
  const pairs = findSimilarComplaints(baseComplaints, { threshold: 1 });
  assert.ok(pairs.length >= 1);
  assert.ok(pairs[0].sharedTokenCount > 0);
  assert.ok(pairs[0].sharedTokens.length === pairs[0].sharedTokenCount);
});

test('findSimilarComplaints handles an empty list', () => {
  assert.deepStrictEqual(findSimilarComplaints([]), []);
});