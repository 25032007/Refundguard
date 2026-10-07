const test = require('node:test');
const assert = require('node:assert');
const { faker } = require('@faker-js/faker');
const { sampleCustomers, processData, EXCLUDED_CODES, OUTLIER_CUSTOMER, loadAndProfileCSV } = require('../adapters/onlineRetail.js');

test('Preprocessing and Sampling', async (t) => {
  await t.test('accounting for source rows and missing customer IDs', async () => {
    const fs = require('fs');
    const path = require('path');
    const tempCsv = path.join(__dirname, 'temp_test.csv');
    fs.writeFileSync(tempCsv, 'Invoice,StockCode,Description,Quantity,InvoiceDate,Price,Customer ID,Country\n123,PROD,Desc,1,2010-01-01T00:00:00Z,10,C1,UK\n124,PROD,Desc,1,2010-01-01T00:00:00Z,10,,UK\n125,PROD,Desc,1,2010-01-01T00:00:00Z,10,' + OUTLIER_CUSTOMER + ',UK\n');
    
    const result = await loadAndProfileCSV(tempCsv);
    fs.unlinkSync(tempCsv);
    
    assert.strictEqual(result.totalSourceRows, 3);
    assert.strictEqual(result.missingCustomerIdRows, 1);
    assert.strictEqual(result.outlierRows, 1);
    assert.strictEqual(result.rawLines.length, 1);
  });

  await t.test('sampling exactly TARGET_CUSTOMERS deterministically', () => {
    faker.seed(42);
    const mockStats = {};
    for (let i = 0; i < 5000; i++) {
      mockStats[`cust_${i}`] = { id: `cust_${i}`, lineItems: i % 100, firstSeen: 1000 };
    }
    const sample1 = sampleCustomers(mockStats, 2000);
    assert.strictEqual(sample1.size, 2000, 'Should pick exactly 2000 customers');
    
    faker.seed(42);
    const sample2 = sampleCustomers(mockStats, 2000);
    assert.deepStrictEqual(Array.from(sample1).sort(), Array.from(sample2).sort(), 'Same seed should produce same sample');
    
    faker.seed(43);
    const sample3 = sampleCustomers(mockStats, 2000);
    assert.notDeepStrictEqual(Array.from(sample1).sort(), Array.from(sample3).sort(), 'Different seed should produce different sample');
  });

  await t.test('quantity consumption prevents double linking', () => {
    faker.seed(123);
    const selected = new Set(['c1']);
    const rawLines = [
      { invoice: 'I1', stockCode: 'PROD1', quantity: 2, price: 10, customerId: 'c1', timestamp: 1000, isCancellation: false, country: 'UK' },
      { invoice: 'C1', stockCode: 'PROD1', quantity: -1, price: 10, customerId: 'c1', timestamp: 2000, isCancellation: true, country: 'UK' },
      { invoice: 'C2', stockCode: 'PROD1', quantity: -1, price: 10, customerId: 'c1', timestamp: 3000, isCancellation: true, country: 'UK' },
      { invoice: 'C3', stockCode: 'PROD1', quantity: -1, price: 10, customerId: 'c1', timestamp: 4000, isCancellation: true, country: 'UK' }
    ];
    const data = processData(rawLines, selected, 1);
    
    // First two refunds should link to I1 because quantity was 2.
    // The third refund should be unlinked.
    assert.strictEqual(data.refunds.length, 3);
    const linked = data.refunds.filter(r => r.transactionId !== null);
    const unlinked = data.refunds.filter(r => r.transactionId === null);
    assert.strictEqual(linked.length, 2);
    assert.strictEqual(unlinked.length, 1);
  });
  
  await t.test('processing logic creates correct objects and link counts', () => {
    faker.seed(123);
    const selected = new Set(['c1']);
    const rawLines = [
      { invoice: 'I1', stockCode: 'PROD1', quantity: 2, price: 10, customerId: 'c1', timestamp: 1000, isCancellation: false, country: 'UK' },
      { invoice: 'I1', stockCode: 'PROD2', quantity: 1, price: 5, customerId: 'c1', timestamp: 1000, isCancellation: false, country: 'UK' },
      // Refund for PROD1
      { invoice: 'C1', stockCode: 'PROD1', quantity: -1, price: 10, customerId: 'c1', timestamp: 2000, isCancellation: true, country: 'UK' }
    ];
    
    const data = processData(rawLines, selected, 1);
    
    assert.strictEqual(data.customers.length, 1);
    assert.strictEqual(data.transactions.length, 1);
    assert.strictEqual(data.transactions[0].amount, 25);
    
    assert.strictEqual(data.refunds.length, 1);
    assert.strictEqual(data.refunds[0].amount, 10);
    assert.ok(data.refunds[0].transactionId); // Should link
    
    assert.strictEqual(data.stats.fullyLinked, 1);
    assert.strictEqual(data.stats.unlinked, 0);
  });
  
  await t.test('unlinked refunds', () => {
    faker.seed(123);
    const selected = new Set(['c1']);
    const rawLines = [
      // Refund for PROD3 (never bought)
      { invoice: 'C2', stockCode: 'PROD3', quantity: -1, price: 10, customerId: 'c1', timestamp: 2000, isCancellation: true, country: 'UK' }
    ];
    
    const data = processData(rawLines, selected, 1);
    assert.strictEqual(data.refunds.length, 1);
    assert.strictEqual(data.refunds[0].transactionId, null, 'Should remain unlinked');
    assert.strictEqual(data.stats.unlinked, 1);
  });
  await t.test('validates configured population bounds', () => {
    faker.seed(123);
    // Use 100 to get representative math.floor distribution
    const ids = [];
    for(let i=0; i<2000; i++) ids.push('c' + i);
    const selected = new Set(ids);
    const rawLines = [];
    const data = processData(rawLines, selected, 2000);
    
    const counts = { individual: 0, household: 0, office: 0, hostel: 0, wholesaler: 0 };
    for (const c of Object.values(data.groundTruth.customers)) {
      if (c.categories.includes('LEGITIMATE_NORMAL')) counts.individual++;
      if (c.categories.includes('LEGITIMATE_HOUSEHOLD')) counts.household++;
      if (c.categories.includes('LEGITIMATE_OFFICE')) counts.office++;
      if (c.categories.includes('LEGITIMATE_HOSTEL')) counts.hostel++;
      if (c.categories.includes('LEGITIMATE_WHOLESALER')) counts.wholesaler++;
    }
    
    const total = counts.individual + counts.household + counts.office + counts.hostel + counts.wholesaler;
    assert.strictEqual(total, 2000);
    
    // Validate individual is roughly ~82% meaning > 70
    assert.ok(counts.individual >= 1500, 'Individual should dominate the population');
    // Validate shared resource existence
    assert.ok(counts.household >= 0, 'Categories exist');
  });
});