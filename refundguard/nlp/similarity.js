/**
 * Deterministic similarity engine.
 *
 * Plain-JavaScript lexical similarity: Jaccard similarity over the unique
 * token sets of two normalized complaint texts. Transparent by design — the
 * score is the fraction of shared vocabulary, and callers also receive the
 * shared tokens themselves so every match is self-explanatory.
 */

const { tokensOf } = require('./normalize');
const config = require('./config');

function tokenSetOf(text) {
  return new Set(tokensOf(text));
}

/**
 * Jaccard similarity between two texts. Returns { score, sharedTokens,
 * sharedTokenCount, tokenCountA, tokenCountB }.
 *
 *   - identical texts score 1
 *   - texts sharing no vocabulary score 0
 *   - symmetric: swapped inputs return the same result
 */
function calculateSimilarity(textA, textB) {
  const tokensA = tokenSetOf(textA);
  const tokensB = tokenSetOf(textB);

  if (tokensA.size === 0 && tokensB.size === 0) {
    return { score: 0, sharedTokens: [], sharedTokenCount: 0, tokenCountA: 0, tokenCountB: 0 };
  }

  const sharedTokens = [...tokensA]
    .filter((token) => tokensB.has(token))
    .sort();

  const unionSize = tokensA.size + tokensB.size - sharedTokens.length;
  const score = unionSize === 0 ? 0 : sharedTokens.length / unionSize;

  return {
    score,
    sharedTokens,
    sharedTokenCount: sharedTokens.length,
    tokenCountA: tokensA.size,
    tokenCountB: tokensB.size,
  };
}

/**
 * Finds all complaint pairs above the similarity threshold.
 *
 * - never compares a complaint with itself
 * - keeps a single A/B pairing per pair (complaintIdA < complaintIdB)
 * - deterministic ordering: similarity desc, then complaintIdA asc,
 *   then complaintIdB asc
 */
function findSimilarComplaints(complaints, options = {}) {
  const threshold = options.threshold !== undefined ? options.threshold : config.similarity.threshold;
  const list = Array.isArray(complaints) ? complaints : [];
  const pairs = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!a || !b || !a.complaintId || !b.complaintId) continue;

      const comparison = calculateSimilarity(a.text, b.text);
      if (comparison.score < threshold) continue;

      // Canonicalize orientation so output is independent of input order
      // (complaintIdA always strictly-before complaintIdB).
      const left = String(a.complaintId) < String(b.complaintId) ? a : b;
      const right = left === a ? b : a;

      pairs.push({
        complaintIdA: String(left.complaintId),
        complaintIdB: String(right.complaintId),
        customerIdA: String(left.customerId !== undefined ? left.customerId : ''),
        customerIdB: String(right.customerId !== undefined ? right.customerId : ''),
        similarity: comparison.score,
        sharedTokens: comparison.sharedTokens,
        sharedTokenCount: comparison.sharedTokenCount,
      });
    }
  }

  pairs.sort(
    (x, y) =>
      y.similarity - x.similarity ||
      compareIds(x.complaintIdA, y.complaintIdA) ||
      compareIds(x.complaintIdB, y.complaintIdB)
  );
  return pairs;
}

function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

module.exports = { calculateSimilarity, findSimilarComplaints };