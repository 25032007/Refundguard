const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const riskEngine = require('../risk-engine/index');

const GENERATED_DIR = path.join(__dirname, '..', 'data', 'generated', 'uci');

/**
 * Prediction rule:
 * The existing risk engine assigns a risk score (0-100) and maps it to a level:
 * 'low', 'medium', 'high', 'critical'.
 *
 * We adapt this to a boolean `predictedFraud` flag by treating 'high' and 'critical'
 * as fraudulent predictions, and 'low' and 'medium' as legitimate predictions.
 */
function isFraudPrediction(level) {
  return level === 'high' || level === 'critical';
}

function loadJson(filename) {
  const filePath = path.join(GENERATED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function generateBenchmark(seed) {
  const isTestCommand = ['test', 'data:test', 'eval:test'].includes(process.env.npm_lifecycle_event);
  const mode = process.env.DATASET_MODE || ((isTestCommand || process.env.CI === 'true') ? 'CI_FIXTURE' : 'REAL_UCI');
  console.log(`DATASET_MODE=${mode}`);

  execSync(`node data/adapters/onlineRetail.js --seed ${seed}`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore'
  });
}

async function evaluateSeed(seed, generate = false) {
  if (generate) {
    await generateBenchmark(seed);
  }

  const dataset = {
    customers: loadJson('customers.json'),
    transactions: loadJson('transactions.json'),
    refunds: loadJson('refunds.json'),
    complaints: loadJson('complaints.json'),
    devices: loadJson('devices.json')
  };
  const groundTruth = loadJson('ground-truth.json');

  // Ground truth indexing
  const gtCustomerMap = groundTruth.customers || {};

  // Run the detection pipeline (risk-engine)
  // We do NOT modify configuration or thresholds.
  const riskResults = riskEngine.analyzeAllCustomers(dataset);

  const predictions = [];
  const scenarioCounts = {};
  let legitimateCount = 0;
  let fraudCount = 0;

  for (const res of riskResults) {
    const gt = gtCustomerMap[res.customerId];
    if (!gt) {
      throw new Error(`Missing ground truth for evaluated customer ${res.customerId}`);
    }

    const groundTruthLabel = gt.label; // 'LEGITIMATE' or 'FRAUD'
    const scenarioCategories = gt.categories || [];

    if (groundTruthLabel === 'LEGITIMATE') {
      legitimateCount++;
    } else if (groundTruthLabel === 'FRAUD') {
      fraudCount++;
      // Count scenario breakdown based on categories
      for (const cat of scenarioCategories) {
        scenarioCounts[cat] = (scenarioCounts[cat] || 0) + 1;
      }
    }

    predictions.push({
      customerId: res.customerId,
      predictedRiskScore: res.score,
      predictedRiskLevel: res.level,
      predictedFraud: isFraudPrediction(res.level),
      groundTruthLabel,
      scenarioCategories
    });
  }

  // Ensure all benchmark customers were evaluated
  if (predictions.length !== dataset.customers.length) {
    throw new Error(`Evaluated ${predictions.length} customers, but benchmark has ${dataset.customers.length}.`);
  }

  const { calculateMetrics, calculateBreakdowns } = require('./metrics');
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
    legitimateHardNegatives: breakdowns.legitimateHardNegatives,
    predictions, // For backwards compatibility or deeper analysis if needed
    metadata: {
      detectorVersion: '0.1.0',
      rule: 'predictedFraud = (level === "high" || level === "critical")',
      rankingScore: 'predictedRiskScore'
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  let seeds = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) {
      seeds.push(parseInt(args[i + 1], 10));
      i++;
    } else if (args[i] === '--seeds' && args[i + 1]) {
      seeds = seeds.concat(args[i + 1].split(',').map(s => parseInt(s.trim(), 10)));
      i++;
    }
  }

  if (seeds.length === 0) {
    console.error("Usage: node run.js --seed <number> [or --seeds 1,2,3]");
    process.exit(1);
  }

  const results = [];
  for (const seed of seeds) {
    if (isNaN(seed)) {
      console.error(`Invalid seed provided.`);
      process.exit(1);
    }
    const result = await evaluateSeed(seed, true);
    results.push(result);
  }

  if (seeds.length === 1) {
    // Output deterministic JSON result
    console.log(JSON.stringify(results[0], null, 2));
  } else {
    const { aggregateMetrics } = require('./metrics');
    const aggregate = aggregateMetrics(results);

    // Stability summary
    const f1s = results.map(r => ({ seed: r.seed, f1: r.metrics.f1 }));
    f1s.sort((a, b) => a.f1 - b.f1);
    const worstSeed = f1s[0].seed;
    const bestSeed = f1s[f1s.length - 1].seed;
    const f1Range = f1s[f1s.length - 1].f1 - f1s[0].f1;
    const materiallyDifferent = f1Range > 0.05; // deterministic heuristic

    const stabilitySummary = {
      bestSeed,
      worstSeed,
      metricRanges: {
        f1: f1Range
      },
      materiallyDifferentResult: materiallyDifferent
    };

    const finalResult = {
      perSeed: results,
      aggregate,
      stabilitySummary
    };
    console.log(JSON.stringify(finalResult, null, 2));
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  evaluateSeed,
  isFraudPrediction
};
