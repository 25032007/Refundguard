const { faker } = require('@faker-js/faker');

const obviousRing = require('./obviousRing');
const noisyRing = require('./noisyRing');
const rotatingIpRing = require('./rotatingIpRing');
const slowBurnRing = require('./slowBurnRing');
const burstRefund = require('./burstRefund');
const subsetSharedResourceRing = require('./subsetSharedResourceRing');

// All scenario families, keyed by the family id stored in ground-truth.
const FAMILIES = {
  obvious_ring: obviousRing,
  noisy_ring: noisyRing,
  rotating_ip_ring: rotatingIpRing,
  slow_burn_ring: slowBurnRing,
  burst_refund: burstRefund,
  subset_shared_resource: subsetSharedResourceRing
};

// The five original families define the standard benchmark. The unseen
// subset_shared_resource family is opted-in explicitly so default benchmark
// generation and existing tests remain unchanged.
const DEFAULT_FAMILIES = [
  'obvious_ring',
  'noisy_ring',
  'rotating_ip_ring',
  'slow_burn_ring',
  'burst_refund'
];

function getCalibration(data) {
  const amounts = data.refunds.map(r => r.amount).filter(a => a > 0 && a < 10000).sort((a, b) => a - b);
  return {
    sampleAmount: () => amounts[faker.number.int({ min: 0, max: amounts.length - 1 })] || Number(faker.number.float({ min: 10, max: 200, fractionDigits: 2 })),
    amounts
  };
}

function injectScenarios(data, seed, options = {}) {
  // Use a separate deterministic faker state for scenarios
  faker.seed(seed + 9999);

  const calibration = getCalibration(data);
  const maxTxTs = data.transactions?.length ? Math.max(...data.transactions.map(t => new Date(t.createdAt).getTime())) : null;
  const refDate = maxTxTs ? new Date(maxTxTs) : new Date('2011-12-09T00:00:00Z');
  const context = { data, faker, calibration, seed, refDate };

  const bgCount = data.customers.length;
  const families = options.families || DEFAULT_FAMILIES;

  for (const family of families) {
    const injector = FAMILIES[family];
    if (!injector) {
      throw new Error(`Unknown scenario family: ${family}`);
    }
    injector(context);
  }

  const injectedCount = data.customers.length - bgCount;

  const scenarioCounts = {};
  for (const family of families) {
    scenarioCounts[family] = data.groundTruth.scenarios.filter(s => s.family === family).length;
  }

  return { bgCount, injectedCount, families, scenarioCounts };
}

function generateUnseenDelta(data, seed, family) {
  return injectScenarios(data, seed, { families: [family] });
}

module.exports = { injectScenarios, FAMILIES, DEFAULT_FAMILIES, generateUnseenDelta };
