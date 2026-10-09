/**
 * Phase 3 evaluation seed plan and frozen-config hash.
 *
 * Design:
 *   - Development seeds 1..10  (threshold selection, engine ablation decisions)
 *   - Held-out seeds  11..30   (untouched evaluation with the frozen config)
 *   - Unseen scenario family: generated once with a frozen config
 *
 * The config hash is a sha256 over the canonical JSON serialization of every
 * detector-related configuration object (risk engine, graph engine, nlp engine)
 * plus the evaluation rule strings. It must be recorded BEFORE the held-out
 * seeds are generated and must NOT change afterward.
 */

const crypto = require('crypto');

const DEVELOPMENT_SEEDS = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10
const HELD_OUT_SEEDS = Array.from({ length: 20 }, (_, i) => i + 11);    // 11..30

const UNSEEN_SEED = 30;
const UNSEEN_FAMILY = 'subset_shared_resource';

/** Overlap threshold used to decide whether a detected ring "matches" a ground-truth ring. */
const RING_MATCH_OVERLAP = 0.5;

/** Ring recovery thresholds reported (benchmark convention, see docs/EVALUATION.md). */
const RING_RECOVERY_THRESHOLDS = [0.3, 0.5, 0.7];

/** Candidate decision thresholds considered on development seeds only. */
const NLP_THRESHOLD_CANDIDATES = [0, 1, 2, 3, 5, 8, 10, 15];
const RING_SCORE_THRESHOLD_CANDIDATES = [0, 10, 20, 25, 30, 40, 50, 75];

/** Minimal member count for a ground-truth scenario to be evaluated as a ring. */
const MIN_RING_MEMBERS = 3;

function canonicalJson(value) {
  return JSON.stringify(value, (k, v) =>
    typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(10)) : v
  );
}

/**
 * Computes a deterministic sha256 over the detector configuration objects and
 * the evaluation rule definitions. Returns the hex digest.
 */
function hashFrozenConfig(frozenConfig) {
  const payload = canonicalJson(frozenConfig);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = {
  DEVELOPMENT_SEEDS,
  HELD_OUT_SEEDS,
  UNSEEN_SEED,
  UNSEEN_FAMILY,
  RING_MATCH_OVERLAP,
  RING_RECOVERY_THRESHOLDS,
  NLP_THRESHOLD_CANDIDATES,
  RING_SCORE_THRESHOLD_CANDIDATES,
  MIN_RING_MEMBERS,
  canonicalJson,
  hashFrozenConfig
};