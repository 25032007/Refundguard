const test = require('node:test');
const assert = require('node:assert');
const supertest = require('supertest');
const app = require('../server');

const agent = supertest(app);

test('Security & Verification Features', async (t) => {
  await t.test('POST /api/v1/auth/login - valid credentials returns JWT token', async () => {
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'analyst@refundguard.io',
      password: 'password123',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'ANALYST');
  });

  await t.test('POST /api/v1/auth/login - invalid password returns 401', async () => {
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'analyst@refundguard.io',
      password: 'wrongpassword',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  await t.test('GET /api/v1/auth/me - returns authenticated profile with Bearer token', async () => {
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'lead@refundguard.io',
      password: 'password123',
    });
    const token = loginRes.body.token;

    const meRes = await agent.get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.role, 'LEAD');
  });

  await t.test('GET /api/v1/audit/verify - verifies cryptographic hash chain', async () => {
    const res = await agent.get('/api/v1/audit/verify').set('X-Analyst-Id', 'analyst-1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert.strictEqual(res.body.data.valid, true);
    assert.ok(res.body.data.genesisHash);
  });
});
