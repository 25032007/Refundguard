const test = require('node:test');
const assert = require('node:assert');
const { faker } = require('@faker-js/faker');
const { processData } = require('../adapters/onlineRetail.js');
const fs = require('fs');

test('Temporal Consistency Preflight', async (t) => {
  await t.test('no generated event depends on current system time and uses 2011 domain', () => {
    faker.seed(42);
    
    // Mock Date.now to return a date far in the future (2030) to catch leaks
    const originalDateNow = Date.now;
    let dateNowCalled = false;
    Date.now = () => {
      dateNowCalled = true;
      return new Date('2030-01-01T00:00:00Z').getTime();
    };

    try {
      const selected = new Set(['cust_missing']);
      const rawLines = []; // No raw lines, forcing the fallback path

      const data = processData(rawLines, selected, 1);
      
      assert.strictEqual(dateNowCalled, false, 'Date.now() should never be called during scenario generation');
      assert.strictEqual(data.customers.length, 1);
      
      const createdDate = new Date(data.customers[0].createdAt);
      assert.ok(
        createdDate.getFullYear() >= 2009 && createdDate.getFullYear() <= 2011,
        `Customer creation date ${createdDate.toISOString()} should be within 2009-2011 benchmark domain`
      );
    } finally {
      Date.now = originalDateNow;
    }
  });
  
  await t.test('same seed remains deterministic', () => {
    faker.seed(123);
    const selected = new Set(['c1']);
    const rawLines = [];
    
    const run1 = processData(rawLines, selected, 1);
    
    faker.seed(123);
    const run2 = processData(rawLines, selected, 1);
    
    assert.deepStrictEqual(run1.customers, run2.customers, 'Same seed should produce identical timestamps');
  });
});
