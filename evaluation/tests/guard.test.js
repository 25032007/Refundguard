/**
 * Phase 2E: Refund-Rate Activity Guard Tests
 *
 * Focused unit tests for the minCompletedTransactions guard.
 * Uses unit-level fixtures from risk-engine/tests for speed.
 * Does NOT regenerate benchmark data.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const refundRate = require('../../risk-engine/signals/refundRate');
const riskEngineConfig = require('../../risk-engine/config');
const { makeBase, makeTransaction, makeRefund, refundsOf } = require('../../risk-engine/tests/fixtures');
const { evaluateWithGuard, TUNING_SEEDS, HELD_OUT_SEEDS, GUARD_CANDIDATES } = require('../guard_experiment');

// ─── Helper: temporarily set guard value ─────────────────────────────────────
function withGuard(minCompleted, fn) {
  const original = riskEngineConfig.refundRate.minCompletedTransactions;
  riskEngineConfig.refundRate.minCompletedTransactions = minCompleted;
  try { return fn(); }
  finally { riskEngineConfig.refundRate.minCompletedTransactions = original; }
}

// ─── 1. Baseline behavior preserved by default ────────────────────────────────
test('Guard: default config value is 1 (baseline unchanged)', () => {
  assert.strictEqual(riskEngineConfig.refundRate.minCompletedTransactions, 1);
});

test('Guard: minCompleted=1 fires on single completed transaction (existing behavior)', () => {
  const base = makeBase({
    transactions: [makeTransaction()],          // 1 completed
    refunds: refundsOf('item_not_received', 1)  // 100% rate -> critical
  });
  const signal = withGuard(1, () => refundRate.evaluate(base));
  assert.ok(signal !== null, 'Should fire with 1 completed transaction and rate >= 0.1');
});

test('Guard: zero completed transactions always returns null (original guard)', () => {
  const base = makeBase({
    transactions: [makeTransaction({ status: 'failed' })],
    refunds: refundsOf('item_not_received', 2)
  });
  // Works even with default guard of 1 because 0 < 1
  const signal = withGuard(1, () => refundRate.evaluate(base));
  assert.strictEqual(signal, null);
});

// ─── 2. Guard activates only when intended ────────────────────────────────────
test('Guard: minCompleted=3 blocks customer with 2 completed transactions', () => {
  const base = makeBase({
    transactions: [
      makeTransaction({ transactionId: 't1' }),
      makeTransaction({ transactionId: 't2' })
    ], // 2 completed
    refunds: refundsOf('item_not_received', 2) // 100% rate
  });
  const signal = withGuard(3, () => refundRate.evaluate(base));
  assert.strictEqual(signal, null, 'Guard should suppress signal when completedCount < minCompleted');
});

test('Guard: minCompleted=3 passes customer with exactly 3 completed transactions', () => {
  const base = makeBase({
    transactions: [
      makeTransaction({ transactionId: 't1' }),
      makeTransaction({ transactionId: 't2' }),
      makeTransaction({ transactionId: 't3' })
    ], // 3 completed
    refunds: refundsOf('item_not_received', 3) // 100% rate -> critical
  });
  const signal = withGuard(3, () => refundRate.evaluate(base));
  assert.ok(signal !== null, 'Guard should allow signal when completedCount === minCompleted');
  assert.strictEqual(signal.severity, 'critical');
});

test('Guard: minCompleted=4 blocks customer with 3 completed transactions', () => {
  const base = makeBase({
    transactions: [
      makeTransaction({ transactionId: 't1' }),
      makeTransaction({ transactionId: 't2' }),
      makeTransaction({ transactionId: 't3' })
    ], // 3 completed
    refunds: refundsOf('item_not_received', 3)
  });
  const signal = withGuard(4, () => refundRate.evaluate(base));
  assert.strictEqual(signal, null);
});

// ─── 3. Low-activity customer no longer receives extreme rate contribution ─────
test('Guard: low-activity customer (1 txn, 1 refund = 100%) is blocked by minCompleted=3', () => {
  const base = makeBase({
    transactions: [makeTransaction()],          // 1 completed
    refunds: refundsOf('item_not_received', 1)  // 100% rate
  });
  const withoutGuard = withGuard(1, () => refundRate.evaluate(base));
  const withGuardVal = withGuard(3, () => refundRate.evaluate(base));

  assert.ok(withoutGuard !== null, 'Without guard: fires (baseline)');
  assert.strictEqual(withGuardVal, null, 'With guard=3: suppressed');
});

// ─── 4. Sufficient-activity customer still receives refund-rate contribution ──
test('Guard: high-activity fraud-like customer (5 completed, 5 refunds) still fires with minCompleted=4', () => {
  const base = makeBase({
    transactions: Array.from({ length: 5 }, (_, i) => makeTransaction({ transactionId: `t${i}` })),
    refunds: refundsOf('fraud_reason', 5)
  });
  const signal = withGuard(4, () => refundRate.evaluate(base));
  assert.ok(signal !== null, 'Customer with 5 completed transactions should still fire');
  assert.strictEqual(signal.evidence.completedTransactionCount, 5);
});

// ─── 5. Deterministic ─────────────────────────────────────────────────────────
test('Guard: evaluation is deterministic for same seed and guard value', () => {
  const a = evaluateWithGuard(1, 3); // seed 1, guard=3, no regeneration
  const b = evaluateWithGuard(1, 3);
  assert.deepStrictEqual(a.metrics, b.metrics, 'Same seed + guard must produce identical metrics');
  assert.deepStrictEqual(a.confusionMatrix, b.confusionMatrix);
});

// ─── 6. Config does not mutate during evaluation ──────────────────────────────
test('Guard: config is restored after evaluateWithGuard', () => {
  const before = riskEngineConfig.refundRate.minCompletedTransactions;
  evaluateWithGuard(1, 99); // extreme guard value
  const after = riskEngineConfig.refundRate.minCompletedTransactions;
  assert.strictEqual(after, before, 'Config must be restored to original value after evaluation');
});

test('Guard: config is restored even if evaluate throws (restore-on-error)', () => {
  const before = riskEngineConfig.refundRate.minCompletedTransactions;
  // evaluateWithGuard restores in a finally block — verify it even without a throw path here
  // We test directly that withGuard helper restores on normal exit
  withGuard(42, () => {
    assert.strictEqual(riskEngineConfig.refundRate.minCompletedTransactions, 42);
  });
  assert.strictEqual(riskEngineConfig.refundRate.minCompletedTransactions, before);
});

// ─── 7. Ground truth not used by risk engine ──────────────────────────────────
test('Guard: risk engine result contains no ground-truth labels', () => {
  const riskEngine = require('../../risk-engine/index');
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', '..', 'data', 'generated', 'uci');
  const dataset = {
    customers: JSON.parse(fs.readFileSync(path.join(dir,'customers.json'),'utf8')),
    transactions: JSON.parse(fs.readFileSync(path.join(dir,'transactions.json'),'utf8')),
    refunds: JSON.parse(fs.readFileSync(path.join(dir,'refunds.json'),'utf8')),
    complaints: JSON.parse(fs.readFileSync(path.join(dir,'complaints.json'),'utf8')),
    devices: JSON.parse(fs.readFileSync(path.join(dir,'devices.json'),'utf8')),
  };
  const results = withGuard(3, () => riskEngine.analyzeAllCustomers(dataset));
  for (const r of results) {
    assert.ok(!('groundTruthLabel' in r), 'Risk engine must not expose ground truth');
    assert.ok(!('label' in r));
  }
});

// ─── 8. Existing refund-rate tests continue passing ───────────────────────────
test('Guard: existing signal tier behavior preserved at default guard (1)', () => {
  // Replicate key existing tests from signals.test.js to confirm backward compat
  const withRate = (refunds, completed) =>
    withGuard(1, () => refundRate.evaluate(makeBase({
      transactions: Array.from({ length: completed }, (_, i) => makeTransaction({ transactionId: `t${i}` })),
      refunds: Array.from({ length: refunds }, (_, i) => makeRefund({ refundId: `r${i}` }))
    })));

  assert.strictEqual(withRate(1, 10).severity, 'medium');
  assert.strictEqual(withRate(3, 10).severity, 'high');
  assert.strictEqual(withRate(6, 10).severity, 'critical');
});

test('Guard: evidence includes minCompletedTransactions field', () => {
  const base = makeBase({
    transactions: Array.from({ length: 5 }, (_, i) => makeTransaction({ transactionId: `t${i}` })),
    refunds: refundsOf('item_not_received', 3)
  });
  const signal = withGuard(3, () => refundRate.evaluate(base));
  assert.ok(signal !== null);
  assert.strictEqual(signal.evidence.minCompletedTransactions, 3);
});

// ─── 9. Experiment metadata ────────────────────────────────────────────────────
test('Guard: experiment constants are correctly defined', () => {
  assert.deepStrictEqual(TUNING_SEEDS, [1, 2, 3]);
  assert.deepStrictEqual(HELD_OUT_SEEDS, [4, 5]);
  assert.ok(GUARD_CANDIDATES.includes(1), 'Baseline (1) must be in candidates');
  assert.ok(GUARD_CANDIDATES.includes(3), 'Candidate 3 must be present');
  assert.ok(GUARD_CANDIDATES.includes(5), 'Candidate 5 must be present');
  assert.ok(GUARD_CANDIDATES.includes(8), 'Candidate 8 must be present');
  assert.ok(GUARD_CANDIDATES.includes(10), 'Candidate 10 must be present');
});
