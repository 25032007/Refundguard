const { faker } = require('@faker-js/faker');

const obviousRing = require('./obviousRing');
const noisyRing = require('./noisyRing');
const rotatingIpRing = require('./rotatingIpRing');
const slowBurnRing = require('./slowBurnRing');
const burstRefund = require('./burstRefund');

function getCalibration(data) {
  const amounts = data.refunds.map(r => r.amount).filter(a => a > 0 && a < 10000).sort((a, b) => a - b);
  return {
    sampleAmount: () => amounts[faker.number.int({ min: 0, max: amounts.length - 1 })] || Number(faker.number.float({ min: 10, max: 200, fractionDigits: 2 })),
    amounts
  };
}

function injectScenarios(data, seed) {
  // Use a separate deterministic faker state for scenarios
  faker.seed(seed + 9999);

  const calibration = getCalibration(data);
  const refDate = new Date('2011-12-09T00:00:00Z');
  const context = { data, faker, calibration, seed, refDate };

  const bgCount = data.customers.length;

  obviousRing(context);
  noisyRing(context);
  rotatingIpRing(context);
  slowBurnRing(context);
  burstRefund(context);

  const injectedCount = data.customers.length - bgCount;
  
  return { bgCount, injectedCount };
}

module.exports = { injectScenarios };
