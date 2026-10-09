/**
 * Phase 3 stats: mean / std / CI95 tests on hand-made values.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { mean, std, tValue, confidenceInterval95, summarize } = require('../stats');

test('mean of [1,2,3,4,5] is 3', () => {
  assert.strictEqual(mean([1, 2, 3, 4, 5]), 3);
});

test('mean of empty is NaN', () => {
  assert.ok(Number.isNaN(mean([])));
});

test('sample std of [2,2,2] is 0', () => {
  assert.strictEqual(std([2, 2, 2]), 0);
});

test('sample std of [1,2,3,4] is sqrt(5/3)', () => {
  const s = std([1, 2, 3, 4]);
  assert.ok(Math.abs(s - Math.sqrt(5 / 3)) < 1e-9);
});

test('t-value table: df=1 is 12.706, df=40 is 2.021, df>40 ~= 1.95996', () => {
  assert.ok(Math.abs(tValue(1) - 12.706) < 1e-9);
  assert.ok(Math.abs(tValue(40) - 2.021) < 1e-9);
  assert.ok(Math.abs(tValue(100) - 1.95996) < 1e-9);
  assert.ok(Number.isNaN(tValue(0)));
});

test('CI95 of a single value is {mean, std:0, ciLow:null, ciHigh:null}', () => {
  const ci = confidenceInterval95([5]);
  assert.strictEqual(ci.mean, 5);
  assert.strictEqual(ci.std, 0);
  assert.strictEqual(ci.ciLow, null);
  assert.strictEqual(ci.ciHigh, null);
});

test('CI95 of [1,2,3,4,5,6,7,8,9,10] is centered on 5.5', () => {
  const ci = confidenceInterval95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Math.abs(ci.mean - 5.5) < 1e-9);
  assert.ok(ci.ciLow < ci.mean);
  assert.ok(ci.mean < ci.ciHigh);
  // t(0.95, df=9) = 2.262, se = 3.02765/sqrt(10) ~= 0.9574
  const expectedHalf = 2.262 * (std([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) / Math.sqrt(10));
  assert.ok(Math.abs(ci.ciHigh - (5.5 + expectedHalf)) < 1e-6);
});

test('summarize composes mean/std/CI fields', () => {
  const s = summarize([1, 2, 3]);
  assert.strictEqual(s.n, 3);
  assert.strictEqual(s.mean, 2);
  assert.strictEqual(s.std, 1);
  assert.ok(s.ciLow < s.ciHigh);
});

test('summarize of empty list has NaN mean and null CI', () => {
  const s = summarize([]);
  assert.ok(Number.isNaN(s.mean));
  assert.strictEqual(s.ciLow, null);
});