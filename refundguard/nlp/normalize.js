/**
 * Deterministic text normalization and tokenization for complaint narratives.
 *
 * Normalization is conservative: lowercase, collapse whitespace, strip
 * punctuation, keep alphanumeric content. Words are NOT stemmed or rewritten,
 * so the original evidence vocabulary survives (e.g. "refund not received"
 * stays recognizably intact).
 */

const config = require('./config');

const STOP_SET = new Set(config.STOP_WORDS);

/**
 * Normalizes raw complaint text into a stable, comparable representation.
 *
 * "Refund NOT received!!! Order #123."  =>  "refund not received order 123"
 */
function normalizeComplaintText(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ') // collapse whitespace runs (incl. removed punctuation)
    .trim();
}

/**
 * Tokenizes normalized text: lowercased alphanumeric tokens, stop words
 * removed, single-character noise dropped. Reflexive negation and refund
 * vocabulary are preserved (see config.PROTECTED_TOKENS).
 */
function tokenize(text) {
  const normalized = typeof text === 'string' ? text : '';
  return normalized
    .split(' ')
    .filter((token) => token.length > 1) // drop single-char noise tokens
    .filter((token) => !STOP_SET.has(token));
}

/**
 * Convenience: normalize + tokenize in one deterministic step.
 */
function tokensOf(text) {
  return tokenize(normalizeComplaintText(text));
}

module.exports = { normalizeComplaintText, tokenize, tokensOf };