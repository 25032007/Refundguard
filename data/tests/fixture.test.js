/**
 * Committed mini-benchmark fixture tests (test:ci).
 *
 * data/fixtures/mini is a deterministic, committed dataset (< 300 customers)
 * regenerated from data/fixtures/ci-online-retail.csv by
 * data/adapters/onlineRetail.js. These tests never touch the heavy UCI
 * benchmark (npm run data:uci), so they always run in test:ci.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const riskEngine = require('../../risk-engine');
const { generate } = require('../adapters/onlineRetail');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'mini');
const FIXTURE_FILES = [
  'customers.json',
  'transactions.json',
  'refunds.json',
  'complaints.json',
  'devices.json',
  'ground-truth.json',
  'metadata.json'
];
const ENGINE_INPUT_FILES = ['customers.json', 'transactions.json', 'refunds.json', 'complaints.json', 'devices.json'];

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function generateInto(outputDir) {
  return generate({ seed: 1, targetCustomers: 240, mode: 'CI_FIXTURE', outputDir });
}

test('Committed mini benchmark fixture', async (t) => {
  await t.test('fixture is complete and stays under 300 customers', () => {
    for (const file of FIXTURE_FILES) {
      assert.ok(fs.existsSync(path.join(FIXTURE_DIR, file)), `${file} must be committed`);
    }

    const customers = loadFixture('customers.json');
    const metadata = loadFixture('metadata.json');
    const groundTruth = loadFixture('ground-truth.json');

    assert.ok(customers.length < 300, `fixture must stay under 300 customers, got ${customers.length}`);
    assert.strictEqual(metadata.totalCustomerCount, customers.length);
    assert.strictEqual(
      metadata.backgroundCustomerCount + metadata.injectedFraudCustomerCount,
      metadata.totalCustomerCount
    );
    assert.strictEqual(Object.keys(groundTruth.customers).length, customers.length);
    assert.strictEqual(groundTruth.scenarios.length, 5);
    assert.ok(metadata.source === 'CI_FIXTURE');
  });

  await t.test('fixture regeneration is deterministic and matches the committed bytes', async () => {
    const dirs = [];
    try {
      for (let i = 0; i < 2; i++) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refundguard-mini-'));
        dirs.push(dir);
        await generateInto(dir);
      }

      for (const file of FIXTURE_FILES) {
        const committed = sha256(fs.readFileSync(path.join(FIXTURE_DIR, file)));
        const runA = sha256(fs.readFileSync(path.join(dirs[0], file)));
        const runB = sha256(fs.readFileSync(path.join(dirs[1], file)));

        assert.strictEqual(runA, runB, `${file} must be identical across two fresh generations`);
        assert.strictEqual(runA, committed, `${file} must match the committed fixture`);
      }
    } finally {
      for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test('ground truth never leaks into engine inputs', () => {
    for (const file of ENGINE_INPUT_FILES) {
      const records = loadFixture(file);
      for (const record of records) {
        assert.strictEqual(record.label, undefined, `${file} records must not carry a label`);
        assert.strictEqual(record.categories, undefined, `${file} records must not carry categories`);
        assert.strictEqual(record.scenarioIds, undefined, `${file} records must not carry scenarioIds`);
        assert.strictEqual(record.scenario, undefined, `${file} records must not carry scenario`);
      }
    }

    for (const tx of loadFixture('transactions.json')) {
      assert.strictEqual(tx.scenario, undefined);
    }
  });

  await t.test('risk engine output on the fixture exposes no ground truth', () => {
    const dataset = {
      customers: loadFixture('customers.json'),
      transactions: loadFixture('transactions.json'),
      refunds: loadFixture('refunds.json'),
      complaints: loadFixture('complaints.json'),
      devices: loadFixture('devices.json')
    };

    const results = riskEngine.analyzeAllCustomers(dataset);
    assert.strictEqual(results.length, dataset.customers.length);

    for (const result of results) {
      assert.ok(!('groundTruthLabel' in result), 'engine results must not contain groundTruthLabel');
      assert.ok(!('label' in result), 'engine results must not contain a label field');
      assert.ok(!('categories' in result), 'engine results must not contain categories');
    }
  });
});
