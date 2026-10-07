/**
 * RefundGuard Temporal Analysis Module (Phase 3A).
 *
 * Provides `analyzeAsOf` and `filterDatasetAsOf` APIs to evaluate customer risk
 * and graph/resource evidence using only information that existed at or before
 * a given `asOf` timestamp.
 *
 * Core Temporal Invariant:
 *   For any asOf = T, NO information after T (transactions, refunds, complaints,
 *   devices, IP/device relationships) may influence the result.
 */

const { toMs } = require('./utils/dates');
const { compareByScoreDesc } = require('./utils/scoring');

/**
 * Extracts event timestamp in milliseconds for a dataset item.
 * Supports requestedAt, createdAt, timestamp, firstSeen.
 * Returns null if no timestamp field is present.
 */
function getItemTimestamp(item) {
  if (!item || typeof item !== 'object') return null;
  const raw = item.requestedAt ?? item.createdAt ?? item.timestamp ?? item.firstSeen;
  if (raw === undefined || raw === null) return null;
  return toMs(raw);
}

/**
 * Filters a dataset so it contains only entities and events that occurred
 * at or before the given `asOf` timestamp.
 *
 * Boundary rule:
 *   event.timestamp <= asOf   --> INCLUDED
 *   event.timestamp > asOf    --> EXCLUDED
 *
 * @param {object} dataset - Raw or structured dataset
 * @param {string|number|Date} asOf - Cutoff timestamp
 * @returns {object} Filtered dataset with no look-ahead leakage
 */
function filterDatasetAsOf(dataset, asOf) {
  if (!dataset || typeof dataset !== 'object') {
    throw new Error('dataset must be an object');
  }
  const asOfMs = toMs(asOf);

  const filtered = {};

  for (const [key, value] of Object.entries(dataset)) {
    if (Array.isArray(value)) {
      filtered[key] = value.filter((item) => {
        const itemTs = getItemTimestamp(item);
        if (itemTs !== null) {
          return itemTs <= asOfMs;
        }
        return true;
      });
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Analyzes customer risk as of a given timestamp.
 *
 * @param {object} dataset
 * @param {string|number|Date} asOf
 * @param {Set<string>} [disabledSignals] - Forwarded for signal ablation experiments
 * @returns {Array<object>} Customer risk analysis results sorted by score desc, customerId asc
 */
function analyzeAsOf(dataset, asOf, disabledSignals) {
  // Lazily require risk engine functions to prevent circular dependency
  const { analyzeCustomerRisk, buildContext } = require('./index');

  const temporalDataset = filterDatasetAsOf(dataset, asOf);
  const asOfMs = toMs(asOf);

  const ctx = buildContext(temporalDataset);
  ctx.now = new Date(asOfMs);

  const results = (temporalDataset.customers || []).map((c) =>
    analyzeCustomerRisk(c.customerId, temporalDataset, ctx, disabledSignals)
  );

  results.sort(compareByScoreDesc);
  return results;
}

module.exports = {
  getItemTimestamp,
  filterDatasetAsOf,
  analyzeAsOf,
};
