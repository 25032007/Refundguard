const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const path = require('path');

process.env.REFUNDGUARD_DATA_DIR = path.join(__dirname, 'fixtures', 'ring-dataset');
process.env.DB_PATH = path.join(__dirname, 'fixtures', 'ring-test.db');

const app = require('../server');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertHumanLabel(label, context) {
  assert.strictEqual(typeof label, 'string', `${context} label must be a string`);
  assert.ok(label.length > 0, `${context} label must not be empty`);
  assert.notStrictEqual(label, 'undefined', `${context} label must not be "undefined"`);
  assert.notStrictEqual(label, 'Undefined', `${context} label must not be "Undefined"`);
  assert.ok(!/undefined/i.test(label), `${context} label must not contain "undefined"`);
}

test('Ring payload and signal label contract', async (t) => {
  const agent = request(app);

  await t.test('summary topSignals expose humanized labels', async () => {
    const res = await agent.get('/api/v1/summary');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.topSignals));
    assert.ok(res.body.topSignals.length > 0, 'summary must report at least one top signal');

    for (const signal of res.body.topSignals) {
      assertHumanLabel(signal.label, `topSignals[${signal.type}]`);
      assert.strictEqual(typeof signal.type, 'string');
      assert.ok(signal.count > 0);
    }
  });

  await t.test('investigation list rows expose topSignal.label', async () => {
    const res = await agent.get('/api/v1/investigations?scope=all&pageSize=100');
    assert.strictEqual(res.status, 200);

    const rowsWithSignal = res.body.items.filter((item) => item.topSignal);
    assert.ok(rowsWithSignal.length > 0, 'at least one list row must carry a top signal');

    for (const item of res.body.items) {
      if (!item.topSignal) continue;
      assertHumanLabel(item.topSignal.label, `items[${item.customerId}].topSignal`);
      assert.strictEqual(typeof item.topSignal.type, 'string');
      assert.strictEqual(typeof item.topSignal.contribution, 'number');
    }
  });

  await t.test('ring list items omit relationshipEdges and report edgeCount', async () => {
    const res = await agent.get('/api/v1/rings');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.total > 0, 'ring fixture must produce at least one ring');
    assert.ok(res.body.items.length > 0);

    for (const item of res.body.items) {
      assert.ok(!('relationshipEdges' in item), 'ring list items must not embed relationshipEdges');
      assert.strictEqual(typeof item.edgeCount, 'number');
      assert.ok(item.edgeCount > 0, 'edgeCount must count the ring relationship edges');
      assert.ok(Array.isArray(item.customerIds));
    }
  });

  await t.test('ring detail returns graph nodes and links', async () => {
    const listRes = await agent.get('/api/v1/rings');
    const ringId = listRes.body.items[0].ringId;

    const res = await agent.get(`/api/v1/rings/${ringId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ringId, ringId);

    const { graph } = res.body;
    assert.ok(graph, 'ring detail must embed a graph section');
    assert.ok(Array.isArray(graph.nodes), 'graph.nodes must be an array');
    assert.ok(Array.isArray(graph.links), 'graph.links must be an array');
    assert.ok(graph.nodes.length > 0, 'graph.nodes must not be empty');
    assert.ok(graph.links.length > 0, 'graph.links must not be empty');
    assert.strictEqual(typeof res.body.edgeCount, 'number');

    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    for (const node of graph.nodes) {
      assert.ok(typeof node.id === 'string' && node.id.length > 0);
      assert.ok(typeof node.type === 'string' && node.type.length > 0);
    }
    for (const link of graph.links) {
      assert.ok(nodeIds.has(link.source), `link source ${link.source} must exist in graph.nodes`);
      assert.ok(nodeIds.has(link.target), `link target ${link.target} must exist in graph.nodes`);
      assert.strictEqual(typeof link.type, 'string');
    }
  });

  await t.test('error responses carry a crypto.randomUUID requestId', async () => {
    const responses = [
      await agent.get('/api/v1/investigations/UNKNOWN_CUSTOMER'),
      await agent.get('/api/v1/rings/UNKNOWN_RING'),
      await agent.get('/api/v1/rings/UNKNOWN_RING/lifecycle'),
      await agent.put('/api/v1/investigations/UNKNOWN_CUSTOMER/decision')
        .set('X-Analyst-Id', 'analyst1')
        .send({ decision: 'MONITOR', expectedVersion: 0 }),
      await agent.put('/api/v1/investigations/C101/decision')
        .send({ decision: 'MONITOR', expectedVersion: 0 }),
      await agent.put('/api/v1/investigations/C101/decision')
        .set('X-Analyst-Id', 'analyst1')
        .send({ decision: 'NOT_A_DECISION' })
    ];

    const seen = new Set();
    for (const res of responses) {
      assert.ok(res.status >= 400, 'error responses are expected here');
      assert.ok(res.body.requestId !== undefined, `status ${res.status} must include a requestId`);
      assert.strictEqual(typeof res.body.requestId, 'string', 'requestId must be a string');
      assert.match(res.body.requestId, UUID_PATTERN, 'requestId must be a UUID v4');
      seen.add(res.body.requestId);
    }

    assert.strictEqual(seen.size, responses.length, 'requestIds must be unique per response');
  });
});
