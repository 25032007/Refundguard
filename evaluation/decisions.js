/**
 * Phase 3 evaluation decision layer.
 *
 * Converts per-customer engine outputs (risk score/level, NLP contribution,
 * ring membership/score) into a boolean fraud prediction under a chosen
 * decision condition. The conditions implement the engine-level ablation
 * (Risk, NLP, Graph, pairings, combined) and the ring-escalation experiment.
 *
 * Determinism: every rule is a pure function of the engine outputs plus an
 * explicit threshold set. No reader touches ground truth; no config is
 * mutated; no engine threshold is changed.
 */

const LEVEL_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function normalizeLevel(level) {
  return String(level || 'LOW').toUpperCase();
}

function highestLevel(a, b) {
  return LEVEL_ORDER[normalizeLevel(a)] >= LEVEL_ORDER[normalizeLevel(b)] ? normalizeLevel(a) : normalizeLevel(b);
}

function riskFlagFromLevel(level) {
  const lvl = normalizeLevel(level);
  return lvl === 'HIGH' || lvl === 'CRITICAL';
}

/**
 * Overall-risk aggregation mirroring backend/services/investigationService.js
 * computeOverallRisk(riskLevel, ring).
 *
 * mode:
 *   'critical_bootstrap'      (default) - exact copy of the backend rule, including
 *                              the redundant forced CRITICAL branch for critical rings.
 *   'no_critical_bootstrap'   - the forced branch removed; falls back to
 *                              highestLevel (expected identical for critical rings).
 *   'no_ring_escalation'      - ignores the ring severity entirely; returns the
 *                              customer risk level only.
 */
function computeOverallRisk(riskLevel, ring, mode = 'critical_bootstrap') {
  const riskLvl = normalizeLevel(riskLevel);
  if (mode === 'no_ring_escalation') return riskLvl;

  const ringSeverity = ring ? normalizeLevel(ring.severity) : 'LOW';

  if (mode === 'critical_bootstrap') {
    if (ring && normalizeLevel(ring.severity) === 'CRITICAL') return 'CRITICAL';
    return highestLevel(riskLvl, ringSeverity);
  }

  if (mode === 'no_critical_bootstrap') {
    return highestLevel(riskLvl, ringSeverity);
  }

  throw new Error(`Unknown overall-risk mode: ${mode}`);
}

/**
 * The production prediction rule: a customer is predicted fraud when the
 * risk-engine level is high or critical. All other conditions below reuse this
 * for the risk component so `risk-only` always matches `isFraudPrediction`.
 */
function riskCondition(feature) {
  return riskFlagFromLevel(feature.riskLevel);
}

function nlpCondition(feature, thresholds) {
  return feature.nlpContribution >= thresholds.nlp;
}

function graphCondition(feature, thresholds) {
  return feature.ring !== null && feature.ring.score >= thresholds.ringScore;
}

/**
 * Condition definitions. Each rule is (feature, thresholds) -> boolean.
 * The combined/pair conditions are OR-gates: a customer is flagged when ANY of
 * the included engines flags them. The risk component is always the production
 * high/critical rule; NLP and ring components use the thresholds chosen on the
 * development seeds only (see report.js).
 */
const CONDITIONS = {
  risk_only: { label: 'Risk only', predicate: (f, t) => riskCondition(f) },
  nlp_only: { label: 'NLP only', predicate: (f, t) => nlpCondition(f, t) },
  graph_only: { label: 'Graph only', predicate: (f, t) => graphCondition(f, t) },
  risk_nlp: { label: 'Risk + NLP', predicate: (f, t) => riskCondition(f) || nlpCondition(f, t) },
  risk_graph: { label: 'Risk + Graph', predicate: (f, t) => riskCondition(f) || graphCondition(f, t) },
  nlp_graph: { label: 'NLP + Graph', predicate: (f, t) => nlpCondition(f, t) || graphCondition(f, t) },
  combined: { label: 'Combined (Risk + NLP + Graph)', predicate: (f, t) => riskCondition(f) || nlpCondition(f, t) || graphCondition(f, t) }
};

/** Key used to look up a condition for select / reporting. */
const CONDITION_KEYS = Object.keys(CONDITIONS);

function conditionPredicate(key) {
  const cond = CONDITIONS[key];
  if (!cond) throw new Error(`Unknown condition: ${key}`);
  return cond.predicate;
}

/**
 * Ranking score used for PR-AUC ordering, aligned with each condition's
 * feature set. Shared 0-100 scale so conditions can be compared fairly in the
 * ablation table. Production risk engine scores map to [0,100] directly; NLP
 * contribution maps according to its configured maximum (nlm max = 15);
 * ring graphs already expose a 0-100 score.
 */
const NLP_MAX = 100 / 15; // nlp config maxContribution = 15 -> scale to 0-100

function rankingScore(feature, conditionKey) {
  let components = [];
  if (conditionKey === 'risk_only') components = [feature.riskScore];
  else if (conditionKey === 'nlp_only') components = [feature.nlpContribution * NLP_MAX];
  else if (conditionKey === 'graph_only') components = [feature.ring ? feature.ring.score : 0];
  else if (conditionKey === 'risk_nlp') components = [feature.riskScore, feature.nlpContribution * NLP_MAX];
  else if (conditionKey === 'risk_graph') components = [feature.riskScore, feature.ring ? feature.ring.score : 0];
  else if (conditionKey === 'nlp_graph') components = [feature.nlpContribution * NLP_MAX, feature.ring ? feature.ring.score : 0];
  else if (conditionKey === 'combined') components = [feature.riskScore, feature.nlpContribution * NLP_MAX, feature.ring ? feature.ring.score : 0];
  else throw new Error(`Unknown condition for ranking: ${conditionKey}`);
  return Math.round(Math.max(...components) * 100) / 100;
}

/**
 * Builds a boolean prediction and ranking score for a customer feature under a
 * condition and threshold set.
 *
 * @param {object} feature  { riskScore, riskLevel, nlpContribution, ring|null }
 * @param {string} conditionKey
 * @param {object} thresholds { nlp, ringScore } (nlp threshold integer; ringScore 0-100)
 */
function predict(feature, conditionKey, thresholds) {
  const predicate = conditionPredicate(conditionKey);
  const predictedFraud = predicate(feature, thresholds);
  const score = rankingScore(feature, conditionKey);
  return { predictedFraud, score, condition: conditionKey };
}

module.exports = {
  CONDITIONS,
  CONDITION_KEYS,
  conditionPredicate,
  predict,
  rankingScore,
  computeOverallRisk,
  riskCondition,
  nlpCondition,
  graphCondition,
  normalizeLevel,
  highestLevel,
  NLP_MAX
};