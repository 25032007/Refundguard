/**
 * Phase 3 benchmark harness.
 *
 * Generates a per-seed benchmark dataset (via the adapter, REAL_UCI) into an
 * isolated output directory, then computes the per-customer engine features
 * exactly once per seed:
 *
 *   risk:  { riskScore, riskLevel }          from risk-engine (production)
 *   nlp:   { nlpContribution }               from nlp engine
 *   graph: { ringId, score, severity, members } ring each customer belongs to
 *
 * The engine outputs are cached to <dir>/eval-features.json so that the
 * expensive engine passes do not need to be recomputed on report reruns.
 * Generation is deterministic; the cache is only a performance artifact and is
 * keyed by the dataset itself (metadata.json seed).
 */

const fs = require('fs');
const path = require('path');
const riskEngine = require('../risk-engine/index');
const nlpEngine = require('../nlp/index');
const graphEngine = require('../graph/index');

const DEFAULT_OUTPUT_ROOT = path.join(__dirname, '..', 'data', 'generated', 'eval');

function seedDir(seed, outputRoot = DEFAULT_OUTPUT_ROOT) {
  return path.join(outputRoot, `seed-${seed}`);
}

function fileNames() {
  return ['customers.json', 'transactions.json', 'refunds.json', 'complaints.json', 'devices.json', 'ground-truth.json', 'metadata.json'];
}

/** Reads the given benchmark (must already be generated). Returns the raw JSON files. */
function loadDataset(dir) {
  const dataset = {};
  for (const name of ['customers', 'transactions', 'refunds', 'complaints', 'devices']) {
    dataset[name] = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  }
  dataset.metadata = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
  return dataset;
}

function loadGroundTruth(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'ground-truth.json'), 'utf8'));
}

/**
 * Generates the benchmark dataset for a seed into its own directory.
 *
 * @param {number} seed
 * @param {object} [options] { targetCustomers, scenarioOptions, outputRoot }
 * @returns {{ dir, metadata }}
 */
async function generateSeed(seed, options = {}) {
  const dir = seedDir(seed, options.outputRoot);
  const { generate } = require('../data/adapters/onlineRetail');
  const result = await generate({
    seed,
    targetCustomers: options.targetCustomers || 2000,
    mode: 'REAL_UCI',
    outputDir: dir,
    scenarioOptions: options.scenarioOptions
  });
  return { dir, metadata: result.metadata };
}

/**
 * Computes per-customer feature rows for a loaded dataset.
 *
 * Returns { features, rings, graphResult }:
 *   features  array aligned with dataset.customers (same order, every customer
 *             present), each row:
 *   { customerId, riskScore, riskLevel, nlpContribution, ring: {ringId, score, severity, memberCount} | null }
 *   rings     the full graph-engine refund-ring detections (unfiltered).
 *
 * Ring assignment: a customer is attached to the highest-scoring ring they
 * belong to (deterministic; same tie-break as the graph engine sort).
 */
function computeFeatures(dataset) {
  const riskResults = riskEngine.analyzeAllCustomers(dataset);
  const riskById = new Map(riskResults.map(r => [r.customerId, r]));

  const nlpResults = nlpEngine.analyzeComplaints(dataset.complaints);
  const nlpById = new Map(nlpResults.perCustomerResults.map(r => [r.customerId, r]));

  const graphResult = graphEngine.analyzeRefundRings(dataset);
  const rings = graphResult.rings || [];
  const ringById = new Map();
  for (const ring of rings) {
    for (const cid of ring.customerIds) {
      const existing = ringById.get(cid);
      if (!existing || ring.score > existing.score || (ring.score === existing.score && ring.ringId < existing.ringId)) {
        ringById.set(cid, ring);
      }
    }
  }

  const features = dataset.customers.map(c => {
    const risk = riskById.get(c.customerId);
    const nlp = nlpById.get(c.customerId);
    const ring = ringById.get(c.customerId) || null;
    return {
      customerId: c.customerId,
      riskScore: risk ? risk.score : 0,
      riskLevel: risk ? risk.level : 'low',
      nlpContribution: nlp ? nlp.nlpContribution : 0,
      ring: ring ? { ringId: ring.ringId, score: Math.round(ring.score * 100) / 100, severity: ring.severity, memberCount: ring.memberCount } : null
    };
  });

  return { features, rings, graphResult };
}

/**
 * Evaluates one seed into a self-contained cached object.
 * - generates the dataset (unless it already exists and skipGenerate is true)
 * - loads it
 * - computes engine features (loading the cache if present)
 *
 * @param {number} seed
 * @param {object} [options] { targetCustomers, scenarioOptions, outputRoot, skipGenerate, forceFeatures }
 * @returns {{ seed, dir, metadata, dataset, groundTruth, features }}
 */
async function evaluateSeed(seed, options = {}) {
  const dir = seedDir(seed, options.outputRoot);
  const exists = fs.existsSync(path.join(dir, 'metadata.json'));

  if (!exists || !options.skipGenerate) {
    await generateSeed(seed, options);
  }

  const dataset = loadDataset(dir);
  const groundTruth = loadGroundTruth(dir);

  const featureCache = path.join(dir, 'eval-features.json');
  const metadataHash = require('./seeds').hashFrozenConfig(dataset.metadata);
  if (fs.existsSync(featureCache) && !options.forceFeatures) {
    const cached = JSON.parse(fs.readFileSync(featureCache, 'utf8'));
    const cacheMeta = cached && cached.metadataHash;
    if (cacheMeta === metadataHash) {
      return { seed, dir, metadata: dataset.metadata, dataset, groundTruth, ...cached };
    }
  }

  const { features, rings, graphResult } = computeFeatures(dataset);
  const enrichedCache = { seed, metadataHash, features, rings, graphResult };
  fs.writeFileSync(featureCache, JSON.stringify(enrichedCache));
  return { seed, dir, metadata: dataset.metadata, dataset, groundTruth, ...enrichedCache };
}

/** True when the seed dataset has already been generated into its directory. */
function isGenerated(seed, outputRoot = DEFAULT_OUTPUT_ROOT) {
  return fs.existsSync(path.join(seedDir(seed, outputRoot), 'metadata.json'));
}

module.exports = {
  DEFAULT_OUTPUT_ROOT,
  seedDir,
  fileNames,
  loadDataset,
  loadGroundTruth,
  generateSeed,
  computeFeatures,
  evaluateSeed,
  isGenerated
};