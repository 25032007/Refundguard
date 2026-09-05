/**
 * Tests for normative text normalization and tokenization.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { normalizeComplaintText, tokenize, tokensOf } = require('../normalize');

test('lowercases text', () => {
  assert.strictEqual(normalizeComplaintText('REFUND NOT RECEIVED'), 'refund not received');
});

test('normalizes repeated whitespace and trims edges', () => {
  assert.strictEqual(normalizeComplaintText('  refund    order   '), 'refund order');
});

test('removes punctuation but preserves alphanumeric content', () => {
  assert.strictEqual(normalizeComplaintText('Refund NOT received!!! Order #123.'), 'refund not received order 123');
  assert.strictEqual(normalizeComplaintText('item, #abc-42 $5'), 'item abc 42 5');
});

test('handles undefined / non-string input without throwing', () => {
  assert.strictEqual(normalizeComplaintText(undefined), '');
  assert.strictEqual(normalizeComplaintText(null), '');
  assert.strictEqual(normalizeComplaintText(123), '');
});

test('is deterministic on the same input', () => {
  const text = 'The package was DAMAGED, please refund!!!';
  assert.strictEqual(normalizeComplaintText(text), normalizeComplaintText(text));
});

test('tokenization removes stop words', () => {
  assert.deepStrictEqual(tokenize('the refund for my order please'), ['refund', 'order']);
});

test('tokenization preserves investigation-relevant tokens (negation + refund vocabulary)', () => {
  const tokens = tokenize('refund not received never arrived no delivery order');
  for (const expected of ['refund', 'not', 'received', 'never', 'arrived', 'no', 'delivery', 'order']) {
    assert.ok(tokens.includes(expected), `expected ${expected} in ${tokens}`);
  }
});

test('tokenization drops single-character noise tokens', () => {
  assert.deepStrictEqual(tokenize('a b refund'), ['refund']);
  assert.deepStrictEqual(tokenize(''), []);
});

test('tokensOf combines normalize + tokenize deterministically', () => {
  assert.deepStrictEqual(tokensOf('The REFUND for Order #123!'), ['refund', 'order', '123']);
  assert.deepStrictEqual(tokensOf('same text'), tokensOf(' SAME text! '));
});