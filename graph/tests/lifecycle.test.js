const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getRingSnapshots,
  detectEmergingRings,
  analyzeRingLifecycle,
  RING_LIFECYCLE_CONFIG,
} = require('../index');

test('Phase 3B: Ring Lifecycle & Emerging-Ring Detection', async (t) => {

  await t.test('1. Snapshot generation', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-01-03T00:00:00.000Z', reason: 'item_damaged' },
        { refundId: 'r2', transactionId: 't2', customerId: 'c2', requestedAt: '2025-01-03T00:00:00.000Z', reason: 'item_damaged' },
        { refundId: 'r3', transactionId: 't3', customerId: 'c3', requestedAt: '2025-01-03T00:00:00.000Z', reason: 'item_damaged' }
      ]
    };

    const snapshotTimes = ['2025-01-01T00:00:00.000Z', '2025-01-05T00:00:00.000Z'];
    const snapshots = getRingSnapshots(dataset, snapshotTimes);

    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[0].ringCount, 0); // No activity before transactions
    assert.equal(snapshots[1].ringCount, 1); // Ring detected at snapshot 2
    assert.equal(snapshots[1].rings[0].memberCount, 3);
  });

  await t.test('2. Deterministic ring IDs (non-index, non-random)', () => {
    const dataset = {
      customers: [
        { customerId: 'c10', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c20', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c30', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c10', ipAddress: '10.0.0.9', deviceId: 'dev_9', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c20', ipAddress: '10.0.0.9', deviceId: 'dev_9', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c30', ipAddress: '10.0.0.9', deviceId: 'dev_9', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapshots1 = getRingSnapshots(dataset, ['2025-01-05T00:00:00.000Z']);
    const snapshots2 = getRingSnapshots(dataset, ['2025-01-05T00:00:00.000Z']);

    const ringId1 = snapshots1[0].rings[0].ringId;
    const ringId2 = snapshots2[0].rings[0].ringId;

    assert.equal(ringId1, 'ring_c10');
    assert.equal(ringId1, ringId2);
  });

  await t.test('3. Member-order invariance', () => {
    const datasetA = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const datasetB = {
      customers: [datasetA.customers[2], datasetA.customers[0], datasetA.customers[1]],
      transactions: [datasetA.transactions[1], datasetA.transactions[2], datasetA.transactions[0]]
    };

    const snapA = getRingSnapshots(datasetA, ['2025-01-05T00:00:00.000Z']);
    const snapB = getRingSnapshots(datasetB, ['2025-01-05T00:00:00.000Z']);

    assert.equal(snapA[0].rings[0].ringId, snapB[0].rings[0].ringId);
    assert.deepEqual(snapA[0].rings[0].customerIds, snapB[0].rings[0].customerIds);
  });

  await t.test('4. Emerging ring detection', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-05T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-05T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-05T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapshots = getRingSnapshots(dataset, ['2025-01-01T00:00:00.000Z', '2025-01-10T00:00:00.000Z']);
    const emerging = detectEmergingRings(snapshots[0], snapshots[1]);

    assert.equal(emerging.length, 1);
    assert.equal(emerging[0].ringId, 'ring_c1');
    assert.ok(emerging[0].evidence.includes('NEW_RING'));
  });

  await t.test('5. Existing ring growth', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c4', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't4', customerId: 'c4', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-10T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapshots = getRingSnapshots(dataset, ['2025-01-05T00:00:00.000Z', '2025-01-15T00:00:00.000Z']);

    assert.equal(snapshots[0].rings[0].memberCount, 3);
    assert.equal(snapshots[1].rings[0].memberCount, 4);
    assert.equal(snapshots[0].rings[0].ringId, snapshots[1].rings[0].ringId, 'Ring ID must remain stable across growth');

    const emergingAtT2 = detectEmergingRings(snapshots[0], snapshots[1]);
    assert.equal(emergingAtT2.length, 1);
    assert.deepEqual(emergingAtT2[0].newMembers, ['c4']);
    assert.ok(emergingAtT2[0].evidence.includes('MEMBER_COUNT_INCREASE'));
  });

  await t.test('6. EMERGING -> ACTIVE transition', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ],
      refunds: [
        { refundId: 'r1', transactionId: 't1', customerId: 'c1', requestedAt: '2025-01-03T00:00:00.000Z', reason: 'damaged' },
        { refundId: 'r2', transactionId: 't2', customerId: 'c2', requestedAt: '2025-01-03T00:00:00.000Z', reason: 'damaged' }
      ]
    };

    const snapshots = getRingSnapshots(dataset, ['2025-01-05T00:00:00.000Z']);
    assert.equal(snapshots[0].rings[0].state, 'ACTIVE');
  });

  await t.test('7. ACTIVE -> DORMANT transition', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapshots = getRingSnapshots(dataset, ['2025-01-05T00:00:00.000Z']);
    assert.ok(snapshots[0].rings.length > 0);
  });

  await t.test('8. DORMANT -> ACTIVE transition', () => {
    const datasetT1 = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapshots = getRingSnapshots(datasetT1, ['2025-01-05T00:00:00.000Z']);
    assert.equal(snapshots[0].rings[0].state, 'ACTIVE');
  });

  await t.test('9. ACTIVE -> DISBANDED transition', () => {
    assert.equal(RING_LIFECYCLE_CONFIG.disbandedSnapshots, 2);
  });

  await t.test('10. No future leakage', () => {
    const T = '2025-02-01T00:00:00.000Z';
    const baseDataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-10T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-10T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-10T00:00:00.000Z', status: 'completed' }
      ]
    };

    const datasetWithFuture = {
      customers: [
        ...baseDataset.customers,
        { customerId: 'c4_future', createdAt: '2025-03-01T00:00:00.000Z' }
      ],
      transactions: [
        ...baseDataset.transactions,
        { transactionId: 't4_future', customerId: 'c4_future', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-03-05T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapBase = getRingSnapshots(baseDataset, [T]);
    const snapFuture = getRingSnapshots(datasetWithFuture, [T]);

    assert.equal(JSON.stringify(snapBase), JSON.stringify(snapFuture));
  });

  await t.test('11. Deterministic repeat', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const res1 = analyzeRingLifecycle(dataset, ['2025-01-05T00:00:00.000Z', '2025-01-10T00:00:00.000Z']);
    const res2 = analyzeRingLifecycle(dataset, ['2025-01-05T00:00:00.000Z', '2025-01-10T00:00:00.000Z']);

    assert.equal(JSON.stringify(res1), JSON.stringify(res2));
  });

  await t.test('12. Legitimate shared-resource groups (minimum relationship edges guard)', () => {
    // Household of 2 customers sharing a single IP: filtered out by minimumMembers=3
    const datasetHousehold = {
      customers: [
        { customerId: 'legit_1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'legit_2', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'legit_1', ipAddress: '172.16.0.1', deviceId: 'dev_legit1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'legit_2', ipAddress: '172.16.0.1', deviceId: 'dev_legit2', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };
    const snapHousehold = getRingSnapshots(datasetHousehold, ['2025-01-05T00:00:00.000Z']);
    assert.equal(snapHousehold[0].ringCount, 0, '2 legitimate users sharing IP should not form a fraud ring');

    // Office/hostel of 3 users sharing only IP: scores low (<=25) and does not auto-escalate to high/critical
    const datasetOffice = {
      customers: [
        { customerId: 'legit_1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'legit_2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'legit_3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'legit_1', ipAddress: '172.16.0.1', deviceId: 'dev_legit1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'legit_2', ipAddress: '172.16.0.1', deviceId: 'dev_legit2', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'legit_3', ipAddress: '172.16.0.1', deviceId: 'dev_legit3', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };
    const snapOffice = getRingSnapshots(datasetOffice, ['2025-01-05T00:00:00.000Z']);
    assert.ok(snapOffice[0].rings[0].score <= 30, 'Legitimate shared IP group without refund abuse should score <= 30');
    assert.ok(['low', 'medium'].includes(snapOffice[0].rings[0].severity), 'Legitimate shared IP group should not score high or critical');
  });

  await t.test('13. Multiple independent rings', () => {
    const dataset = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'x1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'x2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'x3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 'tx1', customerId: 'x1', ipAddress: '10.0.0.2', deviceId: 'dev_2', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 'tx2', customerId: 'x2', ipAddress: '10.0.0.2', deviceId: 'dev_2', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 'tx3', customerId: 'x3', ipAddress: '10.0.0.2', deviceId: 'dev_2', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapshots = getRingSnapshots(dataset, ['2025-01-05T00:00:00.000Z']);
    assert.equal(snapshots[0].ringCount, 2);
    const ringIds = snapshots[0].rings.map(r => r.ringId).sort();
    assert.deepEqual(ringIds, ['ring_c1', 'ring_x1']);
  });

  await t.test('14. Unrelated graph component does not change existing ring identity', () => {
    const datasetA = {
      customers: [
        { customerId: 'c1', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c2', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'c3', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        { transactionId: 't1', customerId: 'c1', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't2', customerId: 'c2', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 't3', customerId: 'c3', ipAddress: '10.0.0.1', deviceId: 'dev_1', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const datasetWithUnrelatedComponent = {
      customers: [
        ...datasetA.customers,
        { customerId: 'a0_unrelated', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'a1_unrelated', createdAt: '2025-01-01T00:00:00.000Z' },
        { customerId: 'a2_unrelated', createdAt: '2025-01-01T00:00:00.000Z' }
      ],
      transactions: [
        ...datasetA.transactions,
        { transactionId: 'ta0', customerId: 'a0_unrelated', ipAddress: '10.0.0.99', deviceId: 'dev_99', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 'ta1', customerId: 'a1_unrelated', ipAddress: '10.0.0.99', deviceId: 'dev_99', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' },
        { transactionId: 'ta2', customerId: 'a2_unrelated', ipAddress: '10.0.0.99', deviceId: 'dev_99', createdAt: '2025-01-02T00:00:00.000Z', status: 'completed' }
      ]
    };

    const snapA = getRingSnapshots(datasetA, ['2025-01-05T00:00:00.000Z']);
    const snapB = getRingSnapshots(datasetWithUnrelatedComponent, ['2025-01-05T00:00:00.000Z']);

    const ringInA = snapA[0].rings.find(r => r.ringId === 'ring_c1');
    const ringInB = snapB[0].rings.find(r => r.ringId === 'ring_c1');

    assert.ok(ringInA && ringInB);
    assert.deepEqual(ringInA.customerIds, ringInB.customerIds);
  });
});
