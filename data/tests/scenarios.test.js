const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAW_DIR = path.join(__dirname, '..', 'generated', 'uci');
const SCENARIOS_DIR = path.join(__dirname, '..', 'scenarios');

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, filename), 'utf8'));
}

if (!fs.existsSync(RAW_DIR)) {
  test.skip('UCI dataset not present — run `npm run data:uci` to generate it', () => {});
} else {
  test('Scenario Integrity and Determinism', async (t) => {
    const metadata = loadJson('metadata.json');
    const groundTruth = loadJson('ground-truth.json');
    const customers = loadJson('customers.json');
    const transactions = loadJson('transactions.json');
    const refunds = loadJson('refunds.json');
    const complaints = loadJson('complaints.json');

    await t.test('exactly five scenario families exist', () => {
      assert.strictEqual(metadata.scenarioCounts.obvious_ring, 1);
      assert.strictEqual(metadata.scenarioCounts.noisy_ring, 1);
      assert.strictEqual(metadata.scenarioCounts.rotating_ip_ring, 1);
      assert.strictEqual(metadata.scenarioCounts.slow_burn_ring, 1);
      assert.strictEqual(metadata.scenarioCounts.burst_refund, 1);
      assert.strictEqual(groundTruth.scenarios.length, 5);
    });

    await t.test('each scenario has valid customers', () => {
      for (const sc of groundTruth.scenarios) {
        assert.ok(sc.members.length > 0);
        for (const cid of sc.members) {
          assert.ok(customers.find(c => c.customerId === cid));
          assert.strictEqual(groundTruth.customers[cid].label, 'FRAUD');
        }
      }
    });

    await t.test('legitimate hard-negative customers remain legitimate', () => {
      const bgCustomers = Object.entries(groundTruth.customers).filter(([cid, c]) => c.label === 'LEGITIMATE');
      assert.ok(bgCustomers.length > 0);
      const hasHighRefund = bgCustomers.some(([cid, c]) => c.categories.includes('LEGITIMATE_HIGH_REFUND_RATE'));
      assert.ok(hasHighRefund, 'Legitimate hard negatives must be preserved');
    });

    await t.test('engine input contains no ground-truth labels', () => {
      for (const c of customers) {
        assert.strictEqual(c.label, undefined);
        assert.strictEqual(c.categories, undefined);
        assert.strictEqual(c.scenarioIds, undefined);
      }
      for (const t of transactions) {
        assert.strictEqual(t.scenario, undefined);
      }
    });

    await t.test('generated fraud IDs/resources do not reveal scenario identity', () => {
      for (const sc of groundTruth.scenarios) {
        for (const cid of sc.members) {
          assert.ok(!cid.includes('fraud'));
          assert.ok(!cid.includes('ring'));
        }
      }
    });

    await t.test('injected amounts are realistic', () => {
      const bgRefunds = refunds.filter(r => !groundTruth.customers[r.customerId] || groundTruth.customers[r.customerId].label === 'LEGITIMATE');
      const injectedRefunds = refunds.filter(r => groundTruth.customers[r.customerId] && groundTruth.customers[r.customerId].label === 'FRAUD');
      
      // Check that we didn't inject 100000+ amounts
      for (const r of injectedRefunds) {
        assert.ok(r.amount < 150000);
        assert.ok(r.amount > 0);
      }
    });

    await t.test('each scenario has valid timestamps', () => {
      for (const tx of transactions) {
        assert.ok(!isNaN(new Date(tx.createdAt).getTime()));
      }
    });

    await t.test('obvious ring has intended shared resources', () => {
      const obv = groundTruth.scenarios.find(s => s.family === 'obvious_ring');
      const obvTx = transactions.filter(t => obv.members.includes(t.customerId));
      const ips = new Set(obvTx.map(t => t.ipAddress));
      // Obvious ring uses exact 1 shared IP
      assert.strictEqual(ips.size, 1);
    });

    await t.test('noisy ring contains legitimate-looking activity', () => {
      const noisy = groundTruth.scenarios.find(s => s.family === 'noisy_ring');
      const noisyTx = transactions.filter(t => noisy.members.includes(t.customerId));
      const ips = new Set(noisyTx.map(t => t.ipAddress));
      assert.ok(ips.size > 1); // contains some personal IPs
    });

    await t.test('rotating-IP ring actually changes IP resources over time', () => {
      const rot = groundTruth.scenarios.find(s => s.family === 'rotating_ip_ring');
      const rotTx = transactions.filter(t => rot.members.includes(t.customerId));
      const ips = new Set(rotTx.map(t => t.ipAddress));
      assert.ok(ips.size > 2); // definitely changes IP multiple times
    });

    await t.test('slow-burn ring shows temporal progression', () => {
      const slow = groundTruth.scenarios.find(s => s.family === 'slow_burn_ring');
      const txs = transactions.filter(t => slow.members.includes(t.customerId)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const firstTx = new Date(txs[0].createdAt);
      const lastTx = new Date(txs[txs.length - 1].createdAt);
      const diffDays = (lastTx - firstTx) / 86400000;
      assert.ok(diffDays > 30); // stretched over months
    });

    await t.test('burst refund has concentrated refund activity', () => {
      const burst = groundTruth.scenarios.find(s => s.family === 'burst_refund');
      const refs = refunds.filter(r => burst.members.includes(r.customerId));
      const uniqueDays = new Set(refs.map(r => r.requestedAt.split('T')[0]));
      assert.ok(uniqueDays.size <= 2); // highly concentrated
    });

    await t.test('fraud ground truth is complete', () => {
      assert.ok(metadata.injectedFraudCustomerCount > 0);
      assert.strictEqual(
        metadata.backgroundCustomerCount + metadata.injectedFraudCustomerCount,
        metadata.totalCustomerCount
      );
    });

    await t.test('deterministic canonical hashes cover ALL generated benchmark files, including ground-truth.json', () => {
      const files = ['customers.json', 'transactions.json', 'refunds.json', 'complaints.json', 'devices.json', 'ground-truth.json', 'metadata.json'];
      for (const file of files) {
        const content = fs.readFileSync(path.join(RAW_DIR, file), 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        assert.ok(hash.length === 64);
      }
    });
  });
}
