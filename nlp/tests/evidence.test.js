/**
 * Tests for complaint evidence extraction.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { extractComplaintEvidence } = require('../evidence');

test('refund wording produces refund evidence', () => {
  const result = extractComplaintEvidence('I never received my order. Please process my refund.');
  assert.ok(result.categories.includes('refund_issue'));
  assert.ok(result.keywords.includes('refund'));
  assert.ok(result.phrases.includes('process my refund'));
});

test('refund-not-received phrase is captured exactly', () => {
  const result = extractComplaintEvidence('Refund not received despite the approval notification.');
  assert.ok(result.categories.includes('refund_issue'));
  assert.ok(result.keywords.includes('refund'));
  assert.ok(result.phrases.includes('refund not received'));
});

test('delivery wording produces delivery evidence', () => {
  const result = extractComplaintEvidence('My package was marked delivered but never arrived.');
  assert.ok(result.categories.includes('delivery_issue'));
  assert.ok(result.phrases.includes('marked delivered'));
  assert.ok(result.phrases.includes('never arrived'));
});

test('damaged wording produces damage evidence', () => {
  const result = extractComplaintEvidence('The product arrived damaged and broken.');
  assert.ok(result.categories.includes('damage_issue'));
  assert.ok(result.keywords.includes('damaged'));
});

test('duplicate charge wording produces duplicate_charge evidence', () => {
  const result = extractComplaintEvidence('I was charged twice for a single order.');
  assert.ok(result.categories.includes('duplicate_charge'));
  assert.ok(result.phrases.includes('charged twice'));
});

test('quality wording produces quality evidence', () => {
  const result = extractComplaintEvidence('The product quality is poor and differs from the description.');
  assert.ok(result.categories.includes('quality_issue'));
  assert.ok(result.phrases.includes('differs from'));
});

test('unrelated text does not receive inappropriate categories', () => {
  const result = extractComplaintEvidence('The quick brown fox jumps over the lazy dog near the river.');
  assert.deepStrictEqual(result.categories, []);
  assert.deepStrictEqual(result.keywords, []);
  assert.deepStrictEqual(result.phrases, []);
});

test('evidence extraction is deterministic', () => {
  const text = 'The package arrived damaged and I would like a refund for the full amount.';
  const a = extractComplaintEvidence(text);
  const b = extractComplaintEvidence(text);
  assert.deepStrictEqual(a, b);
});

test('evidence arrays are sorted for determinism', () => {
  const result = extractComplaintEvidence('The package was marked delivered, damaged on arrival, and the refund was approved.');
  const expected = [...result.categories].sort();
  assert.deepStrictEqual(result.categories, expected);
  assert.deepStrictEqual(result.keywords, [...result.keywords].sort());
  assert.deepStrictEqual(result.phrases, [...result.phrases].sort());
});

test('textLength reflects the raw input length', () => {
  const text = 'Refund!';
  const result = extractComplaintEvidence(text);
  assert.strictEqual(result.textLength, text.length);
});

test('phrase matching respects word boundaries', () => {
  // "late" must not fire from a token inside another word (e.g. "grateful").
  const result = extractComplaintEvidence('I am grateful for the response.');
  assert.ok(!result.categories.includes('delivery_issue'));
});

test('non-string input returns empty evidence', () => {
  assert.deepStrictEqual(extractComplaintEvidence(undefined), { categories: [], keywords: [], phrases: [], textLength: 0 });
});