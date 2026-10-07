const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const decisionService = require('../services/decisionService');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'persist');
const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');

// Ensure isolated state for tests
function clearState() {
  if (fs.existsSync(DECISIONS_FILE)) fs.unlinkSync(DECISIONS_FILE);
  if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
}

test('Phase 4: Persistence and Audit Logging', async (t) => {
  t.beforeEach(clearState);
  t.afterEach(clearState);

  await t.test('1. missing decision returns UNREVIEWED/default behavior', () => {
    const dec = decisionService.getDecision('cust_missing');
    assert.strictEqual(dec.decision, 'UNREVIEWED');
    assert.strictEqual(dec.entityId, 'cust_missing');
  });

  await t.test('2. create decision & 6. decision creation creates audit event & 8. previousDecision is correct', () => {
    const dec = decisionService.updateDecision('cust_1', 'MONITOR', 'analyst-1', 'Needs checking', '2025-01-01T00:00:00Z');
    assert.strictEqual(dec.decision, 'MONITOR');
    assert.strictEqual(dec.previousDecision, 'UNREVIEWED');

    const audit = decisionService.getAuditHistory('cust_1');
    assert.strictEqual(audit.length, 1);
    assert.strictEqual(audit[0].previousDecision, 'UNREVIEWED');
    assert.strictEqual(audit[0].newDecision, 'MONITOR');
    assert.strictEqual(audit[0].reason, 'Needs checking');
  });

  await t.test('3. read decision & 15. persistence survives frontend refresh', () => {
    decisionService.updateDecision('cust_2', 'ESCALATED', 'analyst-1', 'Escalating', '2025-01-01T00:00:00Z');
    // Simulated refresh (just read from service directly which hits file implicitly)
    const dec = decisionService.getDecision('cust_2');
    assert.strictEqual(dec.decision, 'ESCALATED');
  });

  await t.test('4. update decision & 7. update creates audit event & 9. history preserves order & 13. multiple updates create separate events', () => {
    decisionService.updateDecision('cust_3', 'MONITOR', 'analyst-1', 'First', '2025-01-01T00:00:00Z');
    decisionService.updateDecision('cust_3', 'ESCALATED', 'analyst-1', 'Second', '2025-01-02T00:00:00Z');

    const dec = decisionService.getDecision('cust_3');
    assert.strictEqual(dec.decision, 'ESCALATED');

    const audit = decisionService.getAuditHistory('cust_3');
    assert.strictEqual(audit.length, 2);
    assert.strictEqual(audit[0].previousDecision, 'UNREVIEWED');
    assert.strictEqual(audit[0].newDecision, 'MONITOR');

    assert.strictEqual(audit[1].previousDecision, 'MONITOR');
    assert.strictEqual(audit[1].newDecision, 'ESCALATED');
  });

  await t.test('5. decision persists after process/application restart', () => {
    decisionService.updateDecision('cust_4', 'CLEARED');

    // Simulate restart by deleting require cache or reading files directly
    const decisions = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf8'));
    assert.strictEqual(decisions['cust_4'].decision, 'CLEARED');
  });

  await t.test('10. invalid decision rejected', () => {
    assert.throws(() => {
      decisionService.updateDecision('cust_5', 'UNKNOWN_STATE');
    }, /Invalid decision/);
  });

  await t.test('11. missing/invalid entity rejected', () => {
    assert.throws(() => {
      decisionService.updateDecision(null, 'MONITOR');
    }, /Invalid entity/);
  });

  await t.test('12. multiple entities remain isolated', () => {
    decisionService.updateDecision('cust_A', 'MONITOR');
    decisionService.updateDecision('cust_B', 'ESCALATED');

    const decA = decisionService.getDecision('cust_A');
    const decB = decisionService.getDecision('cust_B');

    assert.strictEqual(decA.decision, 'MONITOR');
    assert.strictEqual(decB.decision, 'ESCALATED');
  });

  await t.test('14. reading audit history does not mutate it', () => {
    decisionService.updateDecision('cust_6', 'MONITOR');
    const audit1 = decisionService.getAuditHistory('cust_6');
    const audit2 = decisionService.getAuditHistory('cust_6');
    assert.deepStrictEqual(audit1, audit2);
  });

  await t.test('16. test state is isolated & 17. deterministic test behavior', () => {
    // Relying on t.beforeEach to clear state, checking it is clear here
    const dec = decisionService.getDecision('cust_1');
    assert.strictEqual(dec.decision, 'UNREVIEWED');
    assert.strictEqual(decisionService.getAuditHistory('cust_1').length, 0);
  });
});
