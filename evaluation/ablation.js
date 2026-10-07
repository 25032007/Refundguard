/**
 * Phase 2D: Signal Ablation Analysis
 *
 * Measures the contribution of each signal family to RefundGuard's detection
 * quality by disabling one family at a time and comparing metrics against the
 * baseline (all signals enabled).
 *
 * Architecture note:
 *   The evaluated prediction is driven EXCLUSIVELY by the six risk-engine
 *   signals. The NLP engine (nlp/) and graph/ring engine (graph/) are NOT
 *   connected to the evaluated prediction pipeline (risk-engine/index.js
 *   analyzeAllCustomers). They are therefore absent from this ablation.
 *
 * Ablation conditions:
 *   BASELINE            - All six signals active (no change to detector).
 *   NO_REFUND_FREQ      - Disable refundFrequency signal.
 *   NO_REFUND_RATE      - Disable refundRate signal.
 *   NO_REFUND_VEL       - Disable refundVelocity signal.
 *   NO_REPEATED_RSN     - Disable repeatedReason signal.
 *   NO_SHARED_IP        - Disable sharedIp signal.
 *   NO_SHARED_DEV       - Disable sharedDevice signal.
 *   NO_REFUND_FAMILY    - Disable all three refund-behavior signals.
 *   NO_RESOURCE_SHARING - Disable sharedIp + sharedDevice.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const riskEngine = require('../risk-engine/index');
const { calculateMetrics, calculateBreakdowns, aggregateMetrics } = require('./metrics');

const GENERATED_DIR = path.join(__dirname, '..', 'data', 'generated', 'uci');

function isFraudPrediction(level) {
  return level === 'high' || level === 'critical';
}

function loadJson(filename) {
  const filePath = path.join(GENERATED_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function generateBenchmark(seed) {
  execSync(`node data/adapters/onlineRetail.js --seed ${seed}`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore'
  });
}

/**
 * Evaluates one (seed, disabledSignals) pair against already-generated data.
 * Does NOT regenerate data — caller must call generateBenchmark first.
 *
 * @param {number} seed - For labelling only; does not affect data loading.
 * @param {Set<string>} disabledSignals - Signal names to suppress.
 */
function evaluateCondition(seed, disabledSignals) {
  const dataset = {
    customers: loadJson('customers.json'),
    transactions: loadJson('transactions.json'),
    refunds: loadJson('refunds.json'),
    complaints: loadJson('complaints.json'),
    devices: loadJson('devices.json')
  };
  const groundTruth = loadJson('ground-truth.json');
  const gtCustomerMap = groundTruth.customers || {};

  const riskResults = riskEngine.analyzeAllCustomers(dataset, disabledSignals);

  const predictions = [];
  let legitimateCount = 0;
  let fraudCount = 0;

  for (const res of riskResults) {
    const gt = gtCustomerMap[res.customerId];
    if (!gt) throw new Error(`Missing ground truth for customer ${res.customerId}`);

    const groundTruthLabel = gt.label;
    const scenarioCategories = gt.categories || [];

    if (groundTruthLabel === 'LEGITIMATE') legitimateCount++;
    else if (groundTruthLabel === 'FRAUD') fraudCount++;

    predictions.push({
      customerId: res.customerId,
      predictedRiskScore: res.score,
      predictedRiskLevel: res.level,
      predictedFraud: isFraudPrediction(res.level),
      groundTruthLabel,
      scenarioCategories
    });
  }

  const metricsResult = calculateMetrics(predictions);
  const breakdowns = calculateBreakdowns(predictions);

  return {
    seed,
    counts: {
      customerCount: dataset.customers.length,
      fraudCustomerCount: fraudCount,
      legitimateCustomerCount: legitimateCount
    },
    confusionMatrix: metricsResult.confusionMatrix,
    metrics: metricsResult.metrics,
    scenarios: breakdowns.scenarios,
    legitimateHardNegatives: breakdowns.legitimateHardNegatives
  };
}

/**
 * Ablation condition definitions.
 * Each entry: { id, label, disabledSignals }
 */
const ABLATION_CONDITIONS = [
  {
    id: 'BASELINE',
    label: 'Baseline (all signals active)',
    disabledSignals: new Set()
  },
  {
    id: 'NO_REFUND_FREQ',
    label: 'Ablation: no refundFrequency',
    disabledSignals: new Set(['refundFrequency'])
  },
  {
    id: 'NO_REFUND_RATE',
    label: 'Ablation: no refundRate',
    disabledSignals: new Set(['refundRate'])
  },
  {
    id: 'NO_REFUND_VEL',
    label: 'Ablation: no refundVelocity',
    disabledSignals: new Set(['refundVelocity'])
  },
  {
    id: 'NO_REPEATED_RSN',
    label: 'Ablation: no repeatedReason',
    disabledSignals: new Set(['repeatedReason'])
  },
  {
    id: 'NO_SHARED_IP',
    label: 'Ablation: no sharedIp',
    disabledSignals: new Set(['sharedIp'])
  },
  {
    id: 'NO_SHARED_DEV',
    label: 'Ablation: no sharedDevice',
    disabledSignals: new Set(['sharedDevice'])
  },
  {
    id: 'NO_REFUND_FAMILY',
    label: 'Ablation: no refund-behavior family (freq+rate+vel)',
    disabledSignals: new Set(['refundFrequency', 'refundRate', 'refundVelocity'])
  },
  {
    id: 'NO_RESOURCE_SHARING',
    label: 'Ablation: no resource-sharing family (ip+device)',
    disabledSignals: new Set(['sharedIp', 'sharedDevice'])
  }
];

/**
 * Calculates delta (ablated_mean - baseline_mean) for each metric.
 * Negative delta = worse; positive delta = better when ablated.
 */
function calculateDeltas(ablatedMeans, baselineMeans) {
  const keys = ['precision', 'recall', 'f1', 'fpr', 'prAuc'];
  const deltas = {};
  for (const k of keys) {
    deltas[k] = ablatedMeans[k] - baselineMeans[k];
  }
  return deltas;
}

function extractMeans(aggregate) {
  return {
    precision: aggregate.precision.mean,
    recall: aggregate.recall.mean,
    f1: aggregate.f1.mean,
    fpr: aggregate.fpr.mean,
    prAuc: aggregate.prAuc.mean
  };
}

/**
 * Runs all ablation conditions across the given seeds.
 * Generates benchmark data exactly once per seed.
 *
 * @param {number[]} seeds
 * @param {boolean} [generate=true] - Whether to regenerate data per seed.
 */
function runAblation(seeds, generate = true) {
  const conditionAccumulators = {};
  for (const c of ABLATION_CONDITIONS) {
    conditionAccumulators[c.id] = { condition: c, perSeed: [] };
  }

  for (const seed of seeds) {
    if (generate) generateBenchmark(seed);

    for (const condition of ABLATION_CONDITIONS) {
      const result = evaluateCondition(seed, condition.disabledSignals);
      conditionAccumulators[condition.id].perSeed.push(result);
    }
  }

  // Aggregate
  for (const c of ABLATION_CONDITIONS) {
    conditionAccumulators[c.id].aggregate = aggregateMetrics(
      conditionAccumulators[c.id].perSeed
    );
  }

  const baselineAgg = conditionAccumulators['BASELINE'].aggregate;
  const baselineMeans = extractMeans(baselineAgg);

  const ablations = [];
  for (const c of ABLATION_CONDITIONS) {
    if (c.id === 'BASELINE') continue;
    const entry = conditionAccumulators[c.id];
    const ablatedMeans = extractMeans(entry.aggregate);
    ablations.push({
      id: c.id,
      label: c.label,
      disabledSignals: [...c.disabledSignals],
      aggregate: entry.aggregate,
      deltaVsBaseline: calculateDeltas(ablatedMeans, baselineMeans),
      perSeed: entry.perSeed
    });
  }

  return {
    seeds,
    baseline: {
      label: conditionAccumulators['BASELINE'].condition.label,
      perSeed: conditionAccumulators['BASELINE'].perSeed,
      aggregate: baselineAgg
    },
    ablations,
    metadata: {
      detectorVersion: '0.1.0',
      rule: 'predictedFraud = (level === "high" || level === "critical")',
      nlpConnectedToEvaluation: false,
      graphConnectedToEvaluation: false,
      note: 'NLP and graph engines are not connected to risk-engine analyzeAllCustomers. Ablation covers the six risk-engine signals only.'
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  let seeds = [1, 2, 3, 4, 5];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seeds' && args[i + 1]) {
      seeds = args[i + 1].split(',').map(s => parseInt(s.trim(), 10));
      i++;
    } else if (args[i] === '--seed' && args[i + 1]) {
      seeds = [parseInt(args[i + 1], 10)];
      i++;
    }
  }

  const result = runAblation(seeds);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runAblation,
  evaluateCondition,
  calculateDeltas,
  extractMeans,
  ABLATION_CONDITIONS,
  isFraudPrediction
};
