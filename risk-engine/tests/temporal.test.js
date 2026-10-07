const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeAsOf, filterDatasetAsOf, analyzeAllCustomers, analyzeCustomerRisk } = require('../index');

test('Phase 3A: Temporal Analysis Foundation (analyzeAsOf)', async (t) => {

  await t.test('1. Past events included', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c1', createdAt: '2025-01-03T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c1', createdAt: '2025-01-04T00:00:00.000Z', status: 'completed' },
        { transactionId: 't4', customerId: 'c1', createdAt: '2025-01-05T00:00:00.000Z', status: 'completed' },
        { transactionId: 't5', customerId: 'c1', createdAt: '2025-01-06T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-01-02T12:00:00.000Z', reason: 'item_damaged' },
        { refundId: 'r2', transactionId: 't2', customerId: 'c1', requestedAt: '2025-01-03T12:00:00.000Z', reason: 'item_damaged' },
        { refundId: 'r3', transactionId: 't3', customerId: 'c1', requestedAt: '2025-01-04T12:00:00.000Z', reason: 'item_damaged' }
      ]
    };

    const asOf = '2025-01-05T00:00:00.000Z';
    const results = analyzeAsOf(dataset, asOf);

    assert.equal(results.length, 1);
    const c1Risk = results[0];
    assert.equal(c1Risk.customerId, 'c1');
    assert.ok(c1Risk.score > 0, 'Past events (3 refunds) should affect risk score');
    const freqSignal = c1Risk.signals.find(s => s.type === 'refund_frequency');
    assert.ok(freqSignal, 'refund_frequency signal should fire from past refunds');
    assert.equal(freqSignal.evidence.refundCount, 3);
  });

  await t.test('2. Future events excluded', () => {
    const datasetPastOnly = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c1', createdAt: '2025-01-03T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-01-02T12:00:00.000Z', reason: 'item_damaged' }
      ]
    };

    const datasetWithFuture = {
      customers: [
        ...datasetPastOnly.customers,
        { customerId: 'c2_future', createdAt: '2025-02-01T00:00:00.000Z' }
      ],
      transactions: [
        ...datasetPastOnly.transactions,
        { transactionId: 't3_future', customerId: 'c1', createdAt: '2025-01-20T00:00:00.000Z', status: 'completed' },
        { transactionId: 't4_future', customerId: 'c2_future', createdAt: '2025-02-02T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        ...datasetPastOnly.refunds,
        { refundId: 'r2_future', transactionId: 't3_future', customerId: 'c1', requestedAt: '2025-01-21T00:00:00.000Z', reason: 'item_damaged' }
      ]
    };

    const asOf = '2025-01-10T00:00:00.000Z';
    const resultsPast = analyzeAsOf(datasetPastOnly, asOf);
    const resultsWithFuture = analyzeAsOf(datasetWithFuture, asOf);

    assert.deepEqual(resultsPast, resultsWithFuture, 'Adding future events must not alter past risk analysis');
  });

  await t.test('3. Exact boundary condition', () => {
    const boundaryTs = '2025-03-01T12:00:00.000Z';
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', createdAt: boundaryTs, status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: boundaryTs, reason: 'defective' }
      ]
    };

    // Exactly at boundary: event is included
    const filteredAt = filterDatasetAsOf(dataset, boundaryTs);
    assert.equal(filteredAt.transactions.length, 1);
    assert.equal(filteredAt.refunds.length, 1);

    // 1ms before boundary: event is excluded
    const justBeforeMs = new Date(boundaryTs).getTime() - 1;
    const filteredBefore = filterDatasetAsOf(dataset, justBeforeMs);
    assert.equal(filteredBefore.transactions.length, 0);
    assert.equal(filteredBefore.refunds.length, 0);
  });

  await t.test('4. No look-ahead leakage (shared resources and future graph edges)', () => {
    const T = '2025-05-01T00:00:00.000Z';

    const baseDataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '192.168.1.1', deviceId: 'dev_A', createdAt: '2025-02-01T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c1', ipAddress: '192.168.1.1', deviceId: 'dev_A', createdAt: '2025-03-01T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c1', ipAddress: '192.168.1.1', deviceId: 'dev_A', createdAt: '2025-04-01T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-02-02T00:00:00.000Z', reason: 'other' }
      ]
    };

    // In datasetWithFuture, customer c2 uses the exact same IP and device AFTER timestamp T.
    const datasetWithFuture = {
      customers: [...baseDataset.customers],
      transactions: [
        ...baseDataset.transactions,
        { transactionId: 't4_future', customerId: 'c2', ipAddress: '192.168.1.1', deviceId: 'dev_A', createdAt: '2025-06-01T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [...baseDataset.refunds]
    };

    const res1 = analyzeAsOf(baseDataset, T);
    const res2 = analyzeAsOf(datasetWithFuture, T);

    assert.equal(JSON.stringify(res1), JSON.stringify(res2), 'Future resource sharing must not leak into historical analysis');
  });

  await t.test('5. Monotonic temporal visibility', () => {
    const T1 = '2025-01-10T00:00:00.000Z';
    const T2 = '2025-01-20T00:00:00.000Z';

    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', createdAt: '2025-01-05T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c1', createdAt: '2025-01-15T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-01-06T00:00:00.000Z', reason: 'delay' },
        { refundId: 'r2', transactionId: 't2', customerId: 'c1', requestedAt: '2025-01-16T00:00:00.000Z', reason: 'delay' }
      ]
    };

    const datasetAtT1 = filterDatasetAsOf(dataset, T1);
    const datasetAtT2 = filterDatasetAsOf(dataset, T2);

    for (const txn of datasetAtT1.transactions) {
      assert.ok(
        datasetAtT2.transactions.some(t => t.transactionId === txn.transactionId),
        `Transaction ${txn.transactionId} visible at T1 must remain visible at T2`
      );
    }
    for (const ref of datasetAtT1.refunds) {
      assert.ok(
        datasetAtT2.refunds.some(r => r.refundId === ref.refundId),
        `Refund ${ref.refundId} visible at T1 must remain visible at T2`
      );
    }
  });

  await t.test('6. Determinism (byte-equivalent analytical result)', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-01-03T00:00:00.000Z', reason: 'damaged' }
      ]
    };

    const asOf = '2025-01-10T00:00:00.000Z';
    const run1 = analyzeAsOf(dataset, asOf);
    const run2 = analyzeAsOf(dataset, asOf);

    assert.equal(JSON.stringify(run1), JSON.stringify(run2), 'Repeated analyzeAsOf must yield byte-equivalent JSON output');
  });

  await t.test('7. Existing detector compatibility', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ],
      refunds: []
    };

    const nonTemporalResult = analyzeAllCustomers(dataset);
    assert.equal(nonTemporalResult.length, 1);
    assert.equal(nonTemporalResult[0].score, 0);

    const singleCustomerResult = analyzeCustomerRisk('c1', dataset);
    assert.equal(singleCustomerResult.score, 0);
  });
});
