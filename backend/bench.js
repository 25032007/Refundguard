const request = require('supertest');
const app = require('./server');

async function bench() {
  const agent = request(app);

  // Ensure cache is warm (should be prebuilt on startup)
  await agent.get('/api/v1/health');

  const metrics = { list: [], detail: [], summary: [] };
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await agent.get('/api/v1/investigations?pageSize=100');
    metrics.list.push(performance.now() - start);
  }

  const listRes = await agent.get('/api/v1/investigations?pageSize=100');
  const customerId = listRes.body.items[0]?.customerId;

  if (customerId) {
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await agent.get(`/api/v1/investigations/${customerId}`);
      metrics.detail.push(performance.now() - start);
    }
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await agent.get('/api/v1/summary');
    metrics.summary.push(performance.now() - start);
  }

  const p95 = (arr) => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor(arr.length * 0.95)].toFixed(2);
  };

  console.log(`Benchmarking completed (${iterations} iterations)`);
  console.log(`P95 List: ${p95(metrics.list)} ms`);
  console.log(`P95 Detail: ${customerId ? p95(metrics.detail) : 'N/A'} ms`);
  console.log(`P95 Summary: ${p95(metrics.summary)} ms`);

  const healthRes = await agent.get('/api/v1/health');
  const dataset = healthRes.body.dataset;
  const count = dataset ? dataset.customerCount : 0;

  console.log(`Dataset ID: ${healthRes.body.datasetId || 'unknown'}`);
  console.log(`Customer Count: ${count}`);

  if (count < 1800 || count > 2200) {
    console.warn(`WARNING: Customer count is ${count}, expected ~2,000. Ensure you are running against the UCI dataset.`);
  }

  console.log(`Cold build time: ${healthRes.body.coldBuildMs} ms`);
}

bench().catch(console.error).finally(() => process.exit(0));
