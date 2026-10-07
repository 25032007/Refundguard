const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateSeed } = require('../run');

test('Stability and Determinism', async (t) => {
  await t.test('deterministic repeated evaluation', async () => {
    // Generate and evaluate seed 1 twice
    const result1A = await evaluateSeed(1, true);
    // Don't generate again, just evaluate what was generated, OR generate again to prove generator is deterministic.
    // The prompt says "For at least one seed, run the same evaluation twice and verify identical output."
    // We will generate again to ensure the pipeline is end-to-end deterministic.
    const result1B = await evaluateSeed(1, true);
    
    assert.deepStrictEqual(result1A.metrics, result1B.metrics);
    assert.deepStrictEqual(result1A.counts, result1B.counts);
  });

  await t.test('seed independence', async () => {
    // We already ran seed 1. Now run seed 2.
    const result1 = await evaluateSeed(1, true);
    const result2 = await evaluateSeed(2, true);

    // Verify they are different in some way (e.g. predictions, metrics)
    // We don't require all customers to differ, but the overall result or prediction set should differ.
    assert.notDeepStrictEqual(result1.metrics, result2.metrics, 'Metrics should likely differ between seeds');
    // If metrics happen to be exactly identical by extreme coincidence, we check predictions array
    assert.notDeepStrictEqual(result1.predictions, result2.predictions, 'Predictions should differ between seeds');
  });
});
