const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const path = require('path');

// Set fixture data dir
process.env.REFUNDGUARD_DATA_DIR = path.join(__dirname, 'fixtures', 'dataset');
process.env.DB_PATH = path.join(__dirname, 'fixtures', 'test.db'); // Use memory/test db

const fs = require('fs');
const app = require('../server');

test('API tests', async (t) => {
  t.before(() => {
    const db = require('../services/db');
    db.exec('DELETE FROM decisions; DELETE FROM audit_logs;');
  });

  const agent = request(app);

  await t.test('GET /api/v1/health', async () => {
    const res = await agent.get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.dataset.source, 'test_fixture');
    assert.ok(typeof res.body.coldBuildMs === 'number');
  });

  await t.test('GET /api/v1/summary matches full list', async () => {
    const sumRes = await agent.get('/api/v1/summary');
    const listRes = await agent.get('/api/v1/investigations?scope=all&pageSize=100');

    const { risk: sumRisk, decisions: sumDecisions } = sumRes.body;

    let listRiskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    let listDecCounts = { UNREVIEWED: 0, MONITOR: 0, ESCALATED: 0, CLEARED: 0 };

    for (const item of listRes.body.items) {
      listRiskCounts[item.riskLevel]++;
      listDecCounts[item.decision.status]++;
    }

    assert.deepStrictEqual(sumRisk, listRiskCounts);
    assert.deepStrictEqual(sumDecisions, listDecCounts);
    assert.strictEqual(sumRes.body.dataset.customerCount, 3);
  });

  await t.test('GET /api/v1/investigations - list filters, pagination bounds, scope default', async () => {
    const res = await agent.get('/api/v1/investigations');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.page, 1);
    assert.strictEqual(res.body.pageSize, 50);

    const scopeAll = await agent.get('/api/v1/investigations?scope=all&pageSize=100');
    assert.strictEqual(scopeAll.body.items.length, 3);

    // Default scope is flagged (MEDIUM or higher)
    // C001, C002 have refunds so they might be in ring/higher risk
    // We just check the structure and pagination limits
    const limitMax = await agent.get('/api/v1/investigations?pageSize=200');
    assert.strictEqual(limitMax.body.pageSize, 100);

    const limitMin = await agent.get('/api/v1/investigations?pageSize=-5');
    assert.strictEqual(limitMin.body.pageSize, 1);
  });

  await t.test('GET /api/v1/investigations - facet counts and tie-break order', async () => {
    const res = await agent.get('/api/v1/investigations?scope=all');
    assert.ok(res.body.facets);
    assert.ok(res.body.facets.risk);
    assert.ok(res.body.facets.status);
    assert.ok(res.body.facets.ring);

    // Check tie-break order: score desc, ring score desc, customerId asc
    const items = res.body.items;
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i];
      const b = items[i+1];

      let correct = false;
      if (a.riskScore > b.riskScore) correct = true;
      else if (a.riskScore === b.riskScore) {
        const aRing = a.ring ? a.ring.score : -1;
        const bRing = b.ring ? b.ring.score : -1;
        if (aRing > bRing) correct = true;
        else if (aRing === bRing) {
          if (a.customerId < b.customerId) correct = true;
        }
      }
      assert.ok(correct, 'Tie-break order is correct');
    }
  });

  let v1_expected = 1;
  await t.test('PUT /api/v1/investigations/:id/decision - success, idempotency, history order', async () => {
    const customerId = 'C001';
    // Success
    const res = await agent.put(`/api/v1/investigations/${customerId}/decision`)
      .set('X-Analyst-Id', 'analyst1')
      .send({ decision: 'MONITOR', expectedVersion: 0 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'MONITOR');
    v1_expected = res.body.version; // Should be 2

    // Idempotency
    const resIdemp = await agent.put(`/api/v1/investigations/${customerId}/decision`)
      .set('X-Analyst-Id', 'analyst1')
      .send({ decision: 'MONITOR', expectedVersion: v1_expected });

    assert.strictEqual(resIdemp.status, 200);
    assert.strictEqual(resIdemp.body.version, v1_expected); // version shouldn't change

    // Update again
    const res2 = await agent.put(`/api/v1/investigations/${customerId}/decision`)
      .set('X-Analyst-Id', 'analyst2')
      .send({ decision: 'ESCALATED', reason: 'looks very suspicious', expectedVersion: v1_expected });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.status, 'ESCALATED');
    const v2_expected = res2.body.version;

    // History order (newest first)
    const historyRes = await agent.get(`/api/v1/investigations/${customerId}/history`);
    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.length, 2);
    assert.strictEqual(historyRes.body[0].decision, 'ESCALATED');
    assert.strictEqual(historyRes.body[1].decision, 'MONITOR');
  });

  await t.test('PUT /api/v1/investigations/:id/decision - 409 Conflict', async () => {
    const res = await agent.put(`/api/v1/investigations/C001/decision`)
      .set('X-Analyst-Id', 'analyst1')
      .send({ decision: 'CLEARED', reason: 'all good now ok', expectedVersion: 999 });

    assert.strictEqual(res.status, 409);
    assert.ok(res.body.currentState);
  });

  await t.test('PUT /api/v1/investigations/:id/decision - 401 Missing X-Analyst-Id', async () => {
    const res = await agent.put(`/api/v1/investigations/C001/decision`)
      .send({ decision: 'MONITOR', expectedVersion: 0 });
    assert.strictEqual(res.status, 401);
  });

  await t.test('PUT /api/v1/investigations/:id/decision - 422 Validation Error', async () => {
    const res1 = await agent.put(`/api/v1/investigations/C001/decision`)
      .set('X-Analyst-Id', 'analyst1')
      .send({ decision: 'INVALID' });
    assert.strictEqual(res1.status, 422);

    const res2 = await agent.put(`/api/v1/investigations/C001/decision`)
      .set('X-Analyst-Id', 'analyst1')
      .send({ decision: 'ESCALATED', reason: 'short' });
    assert.strictEqual(res2.status, 422);
  });

  await t.test('PUT /api/v1/investigations/:id/decision - 404 Not Found', async () => {
    const res = await agent.put(`/api/v1/investigations/NON_EXISTENT/decision`)
      .set('X-Analyst-Id', 'analyst1')
      .send({ decision: 'MONITOR' });
    assert.strictEqual(res.status, 404);
  });

  await t.test('GET /api/v1/investigations/:id - Uppercase Enums check', async () => {
    const res = await agent.get('/api/v1/investigations/C001');
    assert.strictEqual(res.status, 200);
    const riskLevel = res.body.summary.overallRisk;
    assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevel));
    const status = res.body.decision.status;
    assert.ok(['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'].includes(status));
  });

  await t.test('GET /api/v1/rings/:ringId/lifecycle - returns lifecycle history', async () => {
    // Get a ring first
    const ringsRes = await agent.get('/api/v1/rings');
    assert.strictEqual(ringsRes.status, 200);
    if (ringsRes.body.items.length > 0) {
      const ringId = ringsRes.body.items[0].ringId;
      const res = await agent.get(`/api/v1/rings/${ringId}/lifecycle`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ringId, ringId);
      assert.ok(Array.isArray(res.body.history));
      if (res.body.history.length > 0) {
        assert.ok(res.body.history[0].state);
        assert.ok(res.body.history[0].lastSeenAt);
        assert.ok(Array.isArray(res.body.history[0].evidenceTriggers));
      }
    }
  });

  await t.test('GET /api/v1/rings/:ringId/lifecycle - returns 404 for unknown ring', async () => {
    const res = await agent.get('/api/v1/rings/UNKNOWN_RING/lifecycle');
    assert.strictEqual(res.status, 404);
  });
});
