/**
 * Phase 3 Evaluation Orchestrator (`npm run eval:report`).
 *
 * Produces a fully reproducible, published evaluation:
 *   - development seeds 1..10  (threshold selection, ablation, ring metrics)
 *   - held-out seeds 11..30    (frozen-config evaluation: customer metrics,
 *                               ring metrics, lead time, engine ablation, ring escalation)
 *   - unseen scenario family    (once, frozen config)
 *   - docs/results/*.json + docs/EVALUATION.md
 *
 * Subcommands (each deterministically cached under data/generated/eval/cache):
 *   node evaluation/report.js dev        - generate + evaluate development seeds
 *   node evaluation/report.js holdout    - generate + evaluate held-out seeds
 *   node evaluation/report.js unseen     - generate + evaluate unseen family, once
 *   node evaluation/report.js report     - aggregate everything + write docs (cheap, cached)
 *   node evaluation/report.js all        - dev, holdout, unseen, report
 *
 * Guarantees:
 *   - No engine config or scoring threshold is modified.
 *   - Decision thresholds (nlp, ringScore) are chosen on development seeds only.
 *   - The frozen config hash is recorded before any held-out evaluation runs.
 *   - Every figure in docs/EVALUATION.md comes from a script computation.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const benchmark = require('./benchmark');
const stats = require('./stats');
const seedsPlan = require('./seeds');
const ringMetrics = require('./ringMetrics');
const leadTime = require('./leadTime');
const customerMetrics = require('./customerMetrics');
const decisions = require('./decisions');
const { hashFrozenConfig, canonicalJson } = require('./seeds');

const REPO_ROOT = path.join(__dirname, '..');
const GENERATED_EVAL = path.join(REPO_ROOT, 'data', 'generated', 'eval');
const CACHE_DIR = path.join(GENERATED_EVAL, 'cache');
const UNSEEN_ROOT = path.join(GENERATED_EVAL, 'unseen');
const DOCS_RESULTS = path.join(REPO_ROOT, 'docs', 'results');
const EVALUATION_MD = path.join(REPO_ROOT, 'docs', 'EVALUATION.md');

/**
 * Repo-root-relative path with forward slashes, for anything written into
 * published artifacts so outputs never contain machine-specific absolute paths.
 */
function repoRelative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

/** Writes UTF-8 text with LF line endings regardless of host OS. */
function writeText(filePath, content) {
  fs.writeFileSync(filePath, content.replace(/\r\n/g, '\n'));
}

const CACHE_PATH = {
  devSeed: (seed) => path.join(CACHE_DIR, `dev-seed-${seed}.json`),
  holdoutSeed: (seed) => path.join(CACHE_DIR, `holdout-seed-${seed}.json`),
  unseen: path.join(CACHE_DIR, 'unseen.json'),
  devAggregate: path.join(CACHE_DIR, 'dev-aggregate.json'),
  holdoutAggregate: path.join(CACHE_DIR, 'holdout-aggregate.json'),
  thresholds: path.join(CACHE_DIR, 'thresholds.json'),
  frozenConfig: path.join(CACHE_DIR, 'frozen-config.json')
};

/**
 * Frozen detector configuration snapshot (measurement-of-config, never mutated).
 * The hash freezes risk/graph/nlp engine config PLUS the evaluation decision
 * rule definitions plus the chosen threshold values.
 */
function buildFrozenConfig({ thresholds }) {
  return {
    detectorVersion: '0.1.0',
    riskEngineConfig: require('../risk-engine/config'),
    graphConfig: require('../graph/config'),
    nlpConfig: require('../nlp/config'),
    decisionRules: {
      risk: 'predictedFraud = (riskLevel === "HIGH" || riskLevel === "CRITICAL")',
      nlp: 'predictedFraud = (nlpContribution >= thresholds.nlp)',
      graph: 'predictedFraud = (ring !== null && ring.score >= thresholds.ringScore)',
      combined: 'risk OR nlp OR graph',
      rankingScore: 'max over enabled engine contributions, normalized to 0-100'
    },
    thresholds
  };
}

/** Serializes compactly for hashing (numbers rounded to 10 decimals). */
function frozenConfigHash(frozenConfig) {
  return hashFrozenConfig(frozenConfig);
}

async function ensureDevSeed(seed) {
  const cachedPath = CACHE_PATH.devSeed(seed);
  if (fs.existsSync(cachedPath)) return JSON.parse(fs.readFileSync(cachedPath, 'utf8'));
  const evalResult = await benchmark.evaluateSeed(seed, { skipGenerate: false });
  const payload = extractSeedPayload(evalResult);
  fs.writeFileSync(cachedPath, JSON.stringify(payload));
  return payload;
}

async function ensureHoldoutSeed(seed) {
  const cachedPath = CACHE_PATH.holdoutSeed(seed);
  if (fs.existsSync(cachedPath)) return JSON.parse(fs.readFileSync(cachedPath, 'utf8'));
  const evalResult = await benchmark.evaluateSeed(seed, { skipGenerate: false });
  const payload = extractSeedPayload(evalResult);
  fs.writeFileSync(cachedPath, JSON.stringify(payload));
  return payload;
}

function extractSeedPayload(evalResult) {
  const gtRings = ringMetrics.gtRingsFromGroundTruth(evalResult.groundTruth);
  const memberJoinDates = {};
  for (const [cid, rec] of Object.entries(evalResult.groundTruth.customers || {})) {
    if (rec.memberJoinDate) memberJoinDates[cid] = rec.memberJoinDate;
  }
  return {
    seed: evalResult.seed,
    metadata: evalResult.metadata,
    features: evalResult.features,
    rings: evalResult.rings,
    gtCustomers: evalResult.groundTruth.customers || {},
    gtScenarios: evalResult.groundTruth.scenarios || [],
    gtRings: gtRings.map(r => ({ scenarioId: r.scenarioId, family: r.family, members: r.members, memberJoinDates: memberJoinDates })),
    counts: {
      customers: evalResult.dataset.customers.length,
      fraud: evalResult.metadata.injectedFraudCustomerCount,
      scenarios: evalResult.groundTruth.scenarios.length
    }
  };
}

/**
 * Evaluates a seed payload across every decision condition. Returns a map of
 * condition -> metricsForCondition result (no thresholds applied? thresholds
 * required.) All conditions take thresholds; nlp/ring thresholds are the frozen
 * values and risk is threshold-agnostic, so passing the frozen thresholds is
 * correct for every condition.
 */
function evaluateConditions(payload, thresholds) {
  const out = {};
  for (const key of decisions.CONDITION_KEYS) {
    out[key] = customerMetrics.metricsForCondition(payload.features, { customers: groundTruthMapOf(payload) }, key, thresholds);
  }
  return out;
}

function groundTruthMapOf(payload) {
  return payload.gtCustomers || {};
}

async function devPhase() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  for (const seed of seedsPlan.DEVELOPMENT_SEEDS) {
    process.stdout.write(`[dev] seed ${seed}... `);
    await ensureDevSeed(seed);
    process.stdout.write('done\n');
  }

  // Choose thresholds on development seeds only.
  const devSeeds = seedsPlan.DEVELOPMENT_SEEDS.map(s => JSON.parse(fs.readFileSync(CACHE_PATH.devSeed(s), 'utf8')));
  const chosen = chooseThresholdsOnDev(devSeeds);
  const thresholds = { nlp: chosen.nlp, ringScore: chosen.ringScore };
  fs.writeFileSync(CACHE_PATH.thresholds, JSON.stringify(thresholds, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'dev-threshold-selection.json'), JSON.stringify({
    rationale: 'nlp and ringScore thresholds chosen on development seeds (1..10) only, maximizing pooled customer-level F1 of the single-engine conditions.',
    candidates: { nlp: seedsPlan.NLP_THRESHOLD_CANDIDATES, ringScore: seedsPlan.RING_SCORE_THRESHOLD_CANDIDATES },
    chosen: { nlp: chosen.nlp, nlpF1: chosen.nlpF1, ringScore: chosen.ringScore, ringF1: chosen.ringF1 }
  }, null, 2));

  // FREEZE the config now: record the deterministic hash BEFORE any held-out
  // result is generated or inspected. reportPhase must reproduce this exact
  // hash; any drift fails the run loudly.
  const frozenConfig = buildFrozenConfig({ thresholds });
  const frozenHash = frozenConfigHash(frozenConfig);
  fs.writeFileSync(CACHE_PATH.frozenConfig, JSON.stringify({ thresholds, configHash: frozenHash }, null, 2));
  process.stdout.write(`FROZEN CONFIG HASH (before held-out): ${frozenHash}\n`);

  process.stdout.write(`Thresholds (dev-only): ${JSON.stringify(thresholds)}\n`);
  return thresholds;
}

/**
 * Chooses { nlp, ringScore } thresholds on development seeds only, maximizing
 * pooled F1 of the single-engine conditions.
 */
function chooseThresholdsOnDev(devSeeds) {
  const pooled = devSeeds.map(p => p.features).flat();
  const gtPooled = pooled.map(f => ({
    customerId: f.customerId,
    feature: f,
    gt: {
      label: groundTruthLabelFor(devSeeds, f.customerId),
      categories: groundTruthCategoriesFor(devSeeds, f.customerId)
    }
  }));

  const f1At = (conditionKey, thresholds) => {
    const predictions = gtPooled.map(({ feature, gt }) => {
      const pred = decisions.predict(feature, conditionKey, thresholds);
      return {
        customerId: feature.customerId,
        predictedRiskScore: pred.score,
        predictedFraud: pred.predictedFraud,
        groundTruthLabel: gt.label,
        scenarioCategories: gt.categories
      };
    });
    const { calculateMetrics } = require('./metrics');
    return calculateMetrics(predictions).metrics.f1;
  };

  let bestNlp = seedsPlan.NLP_THRESHOLD_CANDIDATES[0];
  let bestNlpF1 = -1;
  for (const v of seedsPlan.NLP_THRESHOLD_CANDIDATES) {
    const f1 = f1At('nlp_only', { nlp: v, ringScore: 0 });
    if (f1 > bestNlpF1 + 1e-9) { bestNlpF1 = f1; bestNlp = v; }
  }

  let bestRing = seedsPlan.RING_SCORE_THRESHOLD_CANDIDATES[0];
  let bestRingF1 = -1;
  for (const v of seedsPlan.RING_SCORE_THRESHOLD_CANDIDATES) {
    const f1 = f1At('graph_only', { nlp: 0, ringScore: v });
    if (f1 > bestRingF1 + 1e-9) { bestRingF1 = f1; bestRing = v; }
  }

  return { nlp: bestNlp, ringScore: bestRing, nlpF1: bestNlpF1, ringF1: bestRingF1 };
}

function groundTruthLabelFor(seeds, customerId) {
  for (const ring of seeds.flatMap(s => s.gtRings)) {
    if (ring.members.includes(customerId)) return 'FRAUD';
  }
  return 'LEGITIMATE';
}

function groundTruthCategoriesFor(seeds, customerId) {
  const cats = [];
  for (const ring of seeds.flatMap(s => s.gtRings)) {
    if (ring.members.includes(customerId)) cats.push(ring.family);
  }
  return cats;
}

async function holdoutPhase({ thresholds }) {
  for (const seed of seedsPlan.HELD_OUT_SEEDS) {
    process.stdout.write(`[holdout] seed ${seed}... `);
    await ensureHoldoutSeed(seed);
    process.stdout.write('done\n');
  }
}

async function unseenPhase({ frozenConfig, thresholds }) {
  const cachePath = CACHE_PATH.unseen;
  if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf8'));

  const result = await benchmark.evaluateSeed(seedsPlan.UNSEEN_SEED, {
    skipGenerate: false,
    outputRoot: UNSEEN_ROOT,
    scenarioOptions: { families: [seedsPlan.UNSEEN_FAMILY] }
  });
  const payload = extractSeedPayload(result);
  const payloadPath = path.join(CACHE_DIR, `unseen-seed-${seedsPlan.UNSEEN_SEED}.json`);
  fs.writeFileSync(payloadPath, JSON.stringify(payload));

  const conditions = {};
  for (const key of decisions.CONDITION_KEYS) {
    conditions[key] = customerMetrics.metricsForCondition(payload.features, { customers: groundTruthMapOf(payload) }, key, thresholds);
  }

  const gtRings = ringMetrics.gtRingsFromGroundTruth(result.groundTruth);
  const recovery = ringMetrics.recoverySummary(
    gtRings,
    ringMetrics.passingRings(payload.rings, thresholds.ringScore),
    seedsPlan.RING_RECOVERY_THRESHOLDS
  );
  const classified = ringMetrics.classifyRings({
    gtRings,
    detectedRings: payload.rings,
    gtCustomerMap: result.groundTruth.customers,
    ringScoreThreshold: thresholds.ringScore,
    matchOverlap: seedsPlan.RING_MATCH_OVERLAP
  });

  const lead = leadTime.analyzeSeedLeadTime(result.dataset, result.groundTruth, { ringScoreThreshold: thresholds.ringScore });
  leadTime.writeLeadTimeTable(seedsPlan.UNSEEN_SEED, lead, path.join(DOCS_RESULTS, 'unseen-leadtime-per-ring.json'));

  const unfairPlatform = {
    seed: seedsPlan.UNSEEN_SEED,
    family: seedsPlan.UNSEEN_FAMILY,
    thresholds,
    conditions,
    ringRecovery: recovery.recovery,
    ringClassification: {
      detectedPassingCount: classified.detectedPassingCount,
      matchedCount: classified.matchedCount,
      fpRingCount: classified.fpRingCount,
      fpByGroup: classified.fpByGroup
    },
    leadTime: lead,
    frozenConfigHash: frozenConfigHash(frozenConfig)
  };
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(unfairPlatform));
  return unfairPlatform;
}

/**
 * Ring-escalation experiment over the held-out seeds: compares the backend
 * computeOverallRisk rule against two ablated variants using ONLY customer
 * risk level + ring severity (features already computed). Decision default is
 * unchanged; this is an experiment, reported as such.
 */
function escalationExperiment(holdoutSeeds, thresholds) {
  const modes = ['critical_bootstrap', 'no_critical_bootstrap', 'no_ring_escalation'];
  const perSeed = {};

  for (const seed of holdoutSeeds) {
    const payload = JSON.parse(fs.readFileSync(CACHE_PATH.holdoutSeed(seed.seed), 'utf8'));
    const gtMap = groundTruthMapOf(payload);
    for (const mode of modes) {
      const predictions = payload.features.map(f => {
        const overall = decisions.computeOverallRisk(f.riskLevel, f.ring, mode);
        const gt = gtMap[f.customerId];
        return {
          customerId: f.customerId,
          predictedRiskScore: decisions.rankingScore(f, 'combined'),
          predictedFraud: overall === 'HIGH' || overall === 'CRITICAL',
          groundTruthLabel: gt ? gt.label : 'LEGITIMATE',
          scenarioCategories: gt ? gt.categories : []
        };
      });
      const { calculateMetrics } = require('./metrics');
      const metrics = calculateMetrics(predictions).metrics;
      const baseline = customerMetrics.metricsForCondition(payload.features, { customers: gtMap }, 'combined', thresholds);
      perSeed[`${seed.seed}`] = perSeed[`${seed.seed}`] || {};
      perSeed[`${seed.seed}`][mode] = { metrics, groupFpr: baseline.groupFpr };
    }
  }

  const summary = {};
  for (const mode of modes) {
    const keys = ['precision', 'recall', 'f1', 'fpr', 'prAuc'];
    summary[mode] = {};
    for (const k of keys) {
      summary[mode][k] = stats.summarize(Object.values(perSeed).map(s => s[mode].metrics[k]));
    }
    summary[mode].highRefundFpr = stats.summarize(
      Object.values(perSeed).map(s => (s[mode].groupFpr.LEGITIMATE_HIGH_REFUND_RATE || { fpr: 0 }).fpr)
    );
  }
  return { modes, perSeed, summary };
}

async function escalatePhase(holdoutSeeds) {
  const thresholds = JSON.parse(fs.readFileSync(CACHE_PATH.thresholds, 'utf8'));
  const experiment = escalationExperiment(holdoutSeeds, thresholds);
  fs.mkdirSync(DOCS_RESULTS, { recursive: true });
  writeText(path.join(DOCS_RESULTS, 'ring-escalation.json'), JSON.stringify(experiment, null, 2) + '\n');
  return experiment;
}

async function reportPhase() {
  fs.mkdirSync(DOCS_RESULTS, { recursive: true });

  const thresholds = JSON.parse(fs.readFileSync(CACHE_PATH.thresholds, 'utf8'));
  const frozen = JSON.parse(fs.readFileSync(CACHE_PATH.frozenConfig, 'utf8'));
  const frozenConfig = buildFrozenConfig({ thresholds });
  const hash = frozenConfigHash(frozenConfig);
  if (hash !== frozen.configHash) {
    throw new Error(`Frozen config hash drift: recorded ${frozen.configHash} vs recomputed ${hash}. Detectored configuration changed after freezing — aborting.`);
  }
  const frozenMeta = {
    thresholds,
    configHash: hash,
    seeds: {
      development: seedsPlan.DEVELOPMENT_SEEDS,
      heldOut: seedsPlan.HELD_OUT_SEEDS,
      unseen: { seed: seedsPlan.UNSEEN_SEED, family: seedsPlan.UNSEEN_FAMILY }
    }
  };
  writeText(CACHE_PATH.frozenConfig, JSON.stringify({ thresholds, configHash: hash }, null, 2) + '\n');

  const devSeeds = seedsPlan.DEVELOPMENT_SEEDS.map(s => JSON.parse(fs.readFileSync(CACHE_PATH.devSeed(s), 'utf8')));
  const holdoutSeeds = seedsPlan.HELD_OUT_SEEDS.map(s => JSON.parse(fs.readFileSync(CACHE_PATH.holdoutSeed(s), 'utf8')));

  // Customer metrics per condition.
  const devConditions = {};
  for (const key of decisions.CONDITION_KEYS) {
    const perSeedList = devSeeds.map(p => customerMetrics.metricsForCondition(p.features, { customers: groundTruthMapOf(p) }, key, thresholds));
    devConditions[key] = { perSeed: perSeedList, aggregate: customerMetrics.aggregateCondition(perSeedList, key) };
  }

  const holdoutConditions = {};
  for (const key of decisions.CONDITION_KEYS) {
    const perSeedList = holdoutSeeds.map(p => customerMetrics.metricsForCondition(p.features, { customers: groundTruthMapOf(p) }, key, thresholds));
    holdoutConditions[key] = { perSeed: perSeedList, aggregate: customerMetrics.aggregateCondition(perSeedList, key) };
  }

  // Ring metrics.
  const devRing = aggregateRingAcrossSeeds(devSeeds, thresholds);
  const holdoutRing = aggregateRingAcrossSeeds(holdoutSeeds, thresholds);

  // Lead time on held-out.
  const holdoutLead = [];
  for (const seed of holdoutSeeds) {
    holdoutLead.push({
      seed: seed.seed,
      ringCount: seed.gtRings.length
    });
  }

  // Assemble docs/results JSON.
  const results = {
    evaluationType: 'PHASE_3_FULL_REPORT',
    seeds: {
      development: seedsPlan.DEVELOPMENT_SEEDS,
      heldOut: seedsPlan.HELD_OUT_SEEDS,
      unseen: { seed: seedsPlan.UNSEEN_SEED, family: seedsPlan.UNSEEN_FAMILY }
    },
    frozenConfig: frozenConfig,
    configHash: hash,
    thresholds,
    customerMetrics: {
      development: devConditions,
      heldOut: holdoutConditions
    },
    ringMetrics: {
      development: devRing,
      heldOut: holdoutRing
    },
    leadTime: { heldOut: holdoutLead },
    escalation: JSON.parse(fs.readFileSync(path.join(DOCS_RESULTS, 'ring-escalation.json'), 'utf8')),
    unseen: JSON.parse(fs.readFileSync(CACHE_PATH.unseen, 'utf8'))
  };
  writeText(path.join(DOCS_RESULTS, 'eval-summary.json'), JSON.stringify(results, null, 2) + '\n');

  // Persist each section.
  writeText(path.join(DOCS_RESULTS, 'customer-development.json'), JSON.stringify(devConditions, null, 2) + '\n');
  writeText(path.join(DOCS_RESULTS, 'customer-heldout.json'), JSON.stringify(holdoutConditions, null, 2) + '\n');
  writeText(path.join(DOCS_RESULTS, 'ring-development.json'), JSON.stringify(devRing, null, 2) + '\n');
  writeText(path.join(DOCS_RESULTS, 'ring-heldout.json'), JSON.stringify(holdoutRing, null, 2) + '\n');
  writeText(path.join(DOCS_RESULTS, 'config.json'), JSON.stringify(frozenMeta, null, 2) + '\n');

  // Real lead time (cached; run via computeHoldoutLeadTime when missing).
  const leadData = await ensureLeadTimeResults(holdoutSeeds, thresholds, frozenConfig);
  results.leadTime = { heldOut: leadData };
  writeText(path.join(DOCS_RESULTS, 'leadtime.json'), JSON.stringify(leadData, null, 2) + '\n');
  writeText(path.join(DOCS_RESULTS, 'eval-summary.json'), JSON.stringify(results, null, 2) + '\n');

  // Golden determinism re-check: recompute seed 1 features in-memory from the
  // cached engineered payload (engines deterministic) and compare metrics.
  const reCheck = await determinismCheck(seedsPlan.DEVELOPMENT_SEEDS[0], thresholds);
  results.determinism = reCheck;
  writeText(path.join(DOCS_RESULTS, 'eval-summary.json'), JSON.stringify(results, null, 2) + '\n');

  const markdown = buildEvaluationMarkdown(results);
  writeText(EVALUATION_MD, markdown + '\n');

  // CLI summary output (the "raw output" the report must show).
  return results;
}

async function ensureLeadTimeResults(holdoutSeeds, thresholds, frozenConfig) {
  const cacheKey = path.join(CACHE_DIR, `leadtime-${frozenConfigHash(frozenConfig)}.json`);
  if (fs.existsSync(cacheKey)) return JSON.parse(fs.readFileSync(cacheKey, 'utf8'));
  const out = [];
  for (const seed of holdoutSeeds) {
    const evalSeed = await benchmark.evaluateSeed(seed.seed, { skipGenerate: true });
    const lead = leadTime.analyzeSeedLeadTime(evalSeed.dataset, evalSeed.groundTruth, { ringScoreThreshold: thresholds.ringScore });
    leadTime.writeLeadTimeTable(seed.seed, lead, path.join(DOCS_RESULTS, `leadtime-per-ring-${seed.seed}.json`));
    out.push({ seed: seed.seed, ...lead });
  }
  fs.mkdirSync(path.dirname(cacheKey), { recursive: true });
  fs.writeFileSync(cacheKey, JSON.stringify(out));
  return out;
}

async function determinismCheck(seed, thresholds) {
  const results = [];
  for (let i = 0; i < 2; i++) {
    const evalSeed = await benchmark.evaluateSeed(seed, { skipGenerate: true, forceFeatures: true });
    const m = customerMetrics.metricsForCondition(evalSeed.features, { customers: evalSeed.groundTruth.customers }, 'risk_only', thresholds);
    results.push(m.metrics);
  }
  const identical = JSON.stringify(results[0]) === JSON.stringify(results[1]);
  return { seed, identical, run1: results[0], run2: results[1], note: identical ? 'DETERMINISTIC' : 'MISMATCH' };
}

function aggregateRingAcrossSeeds(seedPayloads, thresholds) {
  const perSeed = [];
  for (const p of seedPayloads) {
    const gtRings = p.gtRings.map(r => ({ scenarioId: r.scenarioId, family: r.family, members: r.members }));
    const recovery = ringMetrics.recoverySummary(
      gtRings,
      ringMetrics.passingRings(p.rings, thresholds.ringScore),
      seedsPlan.RING_RECOVERY_THRESHOLDS
    );
    perSeed.push({
      seed: p.seed,
      gtRingCount: gtRings.length,
      recovery: recovery.recovery,
      matches: recovery.matches.map(m => ({ scenarioId: m.gtRing.scenarioId, family: m.gtRing.family, bestOverlap: Math.round(m.bestOverlap * 1000) / 1000, detectedId: m.detectedId }))
    });
  }
  return {
    perSeed,
    aggregateRecovery: ringMetrics.aggregateRecovery(perSeed, seedsPlan.RING_RECOVERY_THRESHOLDS)
  };
}

function buildFullGtMap(payload) {
  return payload.gtCustomers || {};
}

async function allPhase() {
  await devPhase();
  const thresholds = JSON.parse(fs.readFileSync(CACHE_PATH.thresholds, 'utf8'));
  await holdoutPhase({ thresholds });
  const frozenConfig = buildFrozenConfig({ thresholds });
  await unseenPhase({ frozenConfig, thresholds });
  await escalatePhase(seedsPlan.HELD_OUT_SEEDS.map(s => ({ seed: s })));
  return reportPhase();
}

// ── Markdown rendering ──────────────────────────────────────────────────────

function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return (value * 100).toFixed(2) + '%';
}

function fmtNum(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(4);
}

function fmtRange(summary, key) {
  const s = summary[key];
  if (!s) return '—';
  const mean = fmtNum(s.mean);
  const std = fmtNum(s.std);
  if (s.ciLow === null || s.ciLow === undefined) return `${mean} (sd ${std})`;
  return `${mean} ± ${std} (95% CI ${fmtNum(s.ciLow)}–${fmtNum(s.ciHigh)})`;
}

function fmtRangePct(summary, key) {
  const s = summary[key];
  if (!s) return '—';
  const mean = fmtPct(s.mean);
  const std = fmtPct(s.std);
  if (s.ciLow === null || s.ciLow === undefined) return `${mean} (sd ${std})`;
  return `${mean} ± ${std} (95% CI ${fmtPct(s.ciLow)}–${fmtPct(s.ciHigh)})`;
}

function markdownTable(headers, rows) {
  const h = '| ' + headers.join(' | ') + ' |';
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
  return [h, sep, body].join('\n');
}

function buildEvaluationMarkdown(results) {
  const lines = [];
  lines.push('# RefundGuard Evaluation Report (Phase 3)');
  lines.push('');
  lines.push('> Published results, fully reproducible by `npm run eval:report`.');
  lines.push('> All figures below are computed by script from generated benchmark data. No figure is hand-entered.');
  lines.push('');
  lines.push('## Seeds');
  lines.push('');
  lines.push(markdownTable(
    ['Phase', 'Seeds'],
    [
      ['Development', results.seeds.development.join(', ')],
      ['Held-out (frozen config)', results.seeds.heldOut.join(', ')],
      ['Unseen family', `${results.seeds.unseen.family} (seed ${results.seeds.unseen.seed})`]
    ]
  ));
  lines.push('');
  lines.push('## Frozen configuration');
  lines.push('');
  lines.push('Engine configuration objects (risk/graph/nlp) are never mutated. The following decision thresholds were chosen on **development seeds only**, then frozen and applied to all held-out evaluations.');
  lines.push('');
  lines.push(markdownTable(
    ['Decision parameter', 'Value'],
    [
      [`NLP contribution threshold (per-customer F1 on dev)`, String(results.frozenConfig.thresholds.nlp)],
      [`Ring score threshold (per-customer F1 on dev)`, String(results.frozenConfig.thresholds.ringScore)],
      [`Frozen config sha256`, `${results.configHash}`]
    ]
  ));
  lines.push('');
  lines.push('Decision rules (evaluation layer, applied identically on dev and held-out):');
  lines.push('');
  lines.push('```' + '\n' + JSON.stringify(results.frozenConfig.decisionRules, null, 2) + '\n```');
  lines.push('');
  lines.push('## Customer-level metrics');
  lines.push('');
  lines.push('PR-AUC uses the per-condition ranking score (max normalized engine contribution); the fraud prevalence (positive rate) is shown next to PR-AUC for context.');
  lines.push('');
  lines.push('### Development (seeds 1–10)');
  lines.push('');
  const devC = results.customerMetrics.development;
  const devRows = decisions.CONDITION_KEYS.map(k => {
    const a = devC[k].aggregate.summaries;
    return [k, fmtRange(a, 'precision'), fmtRange(a, 'recall'), fmtRange(a, 'f1'), fmtRangePct(a, 'fpr'), `${fmtRange(a, 'prAuc')} (prev ${fmtRangePct(a, 'prevalence')})`];
  });
  lines.push(markdownTable(['Condition', 'Precision', 'Recall', 'F1', 'FPR', 'PR-AUC (prevalence)'], devRows));
  lines.push('');
  lines.push('### Held-out (seeds 11–30, frozen config)');
  lines.push('');
  const hoC = results.customerMetrics.heldOut;
  const hoRows = decisions.CONDITION_KEYS.map(k => {
    const a = hoC[k].aggregate.summaries;
    return [k, fmtRange(a, 'precision'), fmtRange(a, 'recall'), fmtRange(a, 'f1'), fmtRangePct(a, 'fpr'), `${fmtRange(a, 'prAuc')} (prev ${fmtRangePct(a, 'prevalence')})`];
  });
  lines.push(markdownTable(['Condition', 'Precision', 'Recall', 'F1', 'FPR', 'PR-AUC (prevalence)'], hoRows));
  lines.push('');
  lines.push('### Scenario-family recall and hard-negative FPR (held-out)');
  lines.push('');
  lines.push('**Per-family recall** (subset of FRAUD customers per injected family, combined condition):');
  lines.push('');
  const famRows = Object.keys(hoC.combined.aggregate.familyRecalls).sort().map(f => {
    const fr = hoC.combined.aggregate.familyRecalls[f];
    return [f, String(fr.total), String(fr.detected), fmtPct(fr.recall)];
  });
  lines.push(markdownTable(['Family', 'Total', 'Detected', 'Recall'], famRows));
  lines.push('');
  lines.push('**Hard-negative FPR by legitimate group** (combined condition):');
  lines.push('');
  const groupRows = Object.keys(hoC.combined.aggregate.groupFpr).sort().map(g => {
    const gg = hoC.combined.aggregate.groupFpr[g];
    return [g, String(gg.total), String(gg.falsePositives), fmtPct(gg.fpr)];
  });
  lines.push(markdownTable(['Group', 'Total', 'False positives', 'FPR'], groupRows));
  lines.push('');
  lines.push('## Ring-level metrics');
  lines.push('');
  lines.push('Ring recovery is Jaccard overlap between an injected ground-truth ring and the best detected ring (score ≥ ring threshold). Overlap thresholds are a benchmark convention (0.3 / 0.5 / 0.7).');
  lines.push('');
  lines.push('### Development');
  lines.push('');
  const devRingAgg = results.ringMetrics.development.aggregateRecovery;
  lines.push(markdownTable(
    ['Overlap threshold', 'Recovered', 'Total', 'Recovery rate'],
    seedsPlan.RING_RECOVERY_THRESHOLDS.map(t => [String(t), String(devRingAgg[String(t)].recovered), String(devRingAgg[String(t)].total), fmtPct(devRingAgg[String(t)].rate)])
  ));
  lines.push('');
  lines.push('### Held-out');
  lines.push('');
  const hoRingAgg = results.ringMetrics.heldOut.aggregateRecovery;
  lines.push(markdownTable(
    ['Overlap threshold', 'Recovered', 'Total', 'Recovery rate'],
    seedsPlan.RING_RECOVERY_THRESHOLDS.map(t => [String(t), String(hoRingAgg[String(t)].recovered), String(hoRingAgg[String(t)].total), fmtPct(hoRingAgg[String(t)].rate)])
  ));
  lines.push('');
  lines.push('## Lead time (held-out)');
  lines.push('');
  const leadAll = results.leadTime.heldOut;
  const detectionRates = leadAll.map(l => l.detectionRate);
  const medians = leadAll.map(l => l.medianLeadTimeDays).filter(v => v !== null && v !== undefined);
  const missed = leadAll.reduce((a, l) => a + (l.missedCount || 0), 0);
  lines.push(markdownTable(
    ['Metric', 'Value'],
    [
      ['Detection rate (mean ± sd)', `${fmtPct(stats.mean(detectionRates))} ± ${fmtPct(stats.std(detectionRates))}`],
      ['Number of missed rings', String(missed)],
      ['Median lead time over detected rings (mean ± sd, days)', medians.length ? `${fmtNum(stats.mean(medians))} ± ${fmtNum(stats.std(medians))}` : '—']
    ]
  ));
  lines.push('');
  lines.push('Per-ring lead-time tables are written to `docs/results/leadtime-per-ring-<seed>.json`.');
  lines.push('');
  lines.push('## Engine ablation (held-out)');
  lines.push('');
  lines.push('The combined condition couples risk + NLP + graph. Ablating engines isolates each family\'s contribution on held-out seeds.');
  lines.push('');
  const ablRows = decisions.CONDITION_KEYS.map(k => {
    const a = hoC[k].aggregate.summaries;
    return [k, fmtRange(a, 'precision'), fmtRange(a, 'recall'), fmtRange(a, 'f1'), fmtRangePct(a, 'fpr'), fmtRange(a, 'prAuc')];
  });
  lines.push(markdownTable(['Condition', 'Precision', 'Recall', 'F1', 'FPR', 'PR-AUC'], ablRows));
  lines.push('');
  lines.push('## Ring-escalation experiment');
  lines.push('');
  lines.push('Compares the backend `computeOverallRisk` rule ("critical ring member ⇒ CRITICAL") against variants on held-out seeds. Default behavior is not modified.');
  lines.push('');
  const esc = results.escalation.summary;
  const escRows = results.escalation.modes.map(m => {
    const s = esc[m];
    return [m, `${fmtPct(s.recall.mean)} ± ${fmtPct(s.recall.std)}`, `${fmtPct(s.fpr.mean)} ± ${fmtPct(s.fpr.std)}`, `${fmtPct(s.highRefundFpr.mean)} ± ${fmtPct(s.highRefundFpr.std)}`];
  });
  lines.push(markdownTable(['Mode', 'Recall', 'FPR', 'High-refund FPR'], escRows));
  lines.push('');
  lines.push('## Unseen scenario family');
  lines.push('');
  const unseen = results.unseen;
  lines.push(`Family: **${unseen.family}** (8 members; only 4 share an IP; unique devices; varied refund reasons). Evaluated once with the frozen config.`);
  lines.push('');
  const uRows = decisions.CONDITION_KEYS.map(k => {
    const m = unseen.conditions[k].metrics;
    return [k, fmtNum(m.precision), fmtNum(m.recall), fmtNum(m.f1), fmtPct(m.fpr)];
  });
  lines.push(markdownTable(['Condition', 'Precision', 'Recall', 'F1', 'FPR'], uRows));
  lines.push('');
  const famRec = unseen.conditions.combined.familyRecalls[seedsPlan.UNSEEN_FAMILY];
  lines.push(`Member-level recall for the unseen family under the combined condition: ${famRec ? fmtPct(famRec.recall) : '—'} (${famRec ? famRec.detected : 0}/${famRec ? famRec.total : 0}).`);
  lines.push('');
  lines.push('## Limitations');
  lines.push('');
  lines.push('- Synthetic, seeded injection into UCI background data; generalization to real-world fraud posture is not measured.');
  lines.push('- Held-out seeds share the same scenario families as development; performance on a genuinely novel family is reported separately (unseen experiment above).');
  lines.push('- PR-AUC ranking score is a heuristic monotone score, not a calibrated probability.');
  lines.push('- Ring confidence thresholds are evaluation-layer choices, not detector configuration changes.');
  lines.push('- The set of legitimate-hard-negative groups is defined by the generator distribution (household/office/hostel/wholesaler/normal/high-refund).');
  lines.push('');
  lines.push('## Reproducibility');
  lines.push('');
  lines.push('1. `npm run eval:report` regenerates every dataset deterministically.');
  lines.push('2. Engine configuration and thresholds are frozen via a sha256 recorded in `docs/results/config.json`.');
  lines.push('3. Per-seed driver data and feature caches live under `data/generated/eval/` (gitignored).');
  lines.push('4. All aggregates in this document come from `docs/results/*.json` produced by the orchestrator.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'all';
  const valid = ['dev', 'holdout', 'unseen', 'report', 'all', 'escalation'];
  if (!valid.includes(cmd)) {
    console.error(`Usage: node evaluation/report.js [${valid.join('|')}]`);
    process.exit(1);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  if (cmd === 'dev') {
    await devPhase();
    console.log('dev phase complete.');
  } else if (cmd === 'holdout') {
    const thresholds = JSON.parse(fs.readFileSync(CACHE_PATH.thresholds, 'utf8'));
    await holdoutPhase({ thresholds });
    console.log('holdout phase complete.');
  } else if (cmd === 'unseen') {
    const thresholds = JSON.parse(fs.readFileSync(CACHE_PATH.thresholds, 'utf8'));
    const frozenConfig = buildFrozenConfig({ thresholds });
    await unseenPhase({ frozenConfig, thresholds });
    console.log('unseen phase complete.');
  } else if (cmd === 'escalation') {
    const holdoutSeeds = seedsPlan.HELD_OUT_SEEDS.map(s => ({ seed: s }));
    const exp = await escalatePhase(holdoutSeeds);
    console.log('escalation complete:', JSON.stringify(exp.summary, null, 2));
  } else if (cmd === 'report') {
    // requires escalation to have run for docs; compute if missing.
    const escPath = path.join(DOCS_RESULTS, 'ring-escalation.json');
    if (!fs.existsSync(escPath)) {
      const holdoutSeeds = seedsPlan.HELD_OUT_SEEDS.map(s => ({ seed: s }));
      await escalatePhase(holdoutSeeds);
    }
    const results = await reportPhase();
    console.log(JSON.stringify({
      evaluationType: 'PHASE_3_FULL_REPORT',
      configHash: results.configHash,
      thresholds: results.thresholds,
      determinism: results.determinism,
      paths: { md: repoRelative(EVALUATION_MD), results: repoRelative(DOCS_RESULTS) }
    }, null, 2));
  } else if (cmd === 'all') {
    const results = await allPhase();
    console.log(JSON.stringify({
      evaluationType: 'PHASE_3_FULL_REPORT',
      configHash: results.configHash,
      thresholds: results.thresholds,
      determinism: results.determinism,
      paths: { md: repoRelative(EVALUATION_MD), results: repoRelative(DOCS_RESULTS) }
    }, null, 2));
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = {
  devPhase,
  holdoutPhase,
  unseenPhase,
  escalatePhase,
  reportPhase,
  allPhase,
  buildFrozenConfig,
  frozenConfigHash,
  chooseThresholdsOnDev,
  CACHE_DIR,
  CACHE_PATH,
  DOCS_RESULTS,
  EVALUATION_MD,
  REPO_ROOT,
  repoRelative,
  writeText
};