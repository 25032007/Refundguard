const test = require('node:test');
const assert = require('node:assert');
const { selectSnapshotDates } = require('../services/investigationService');

test('Snapshot Selection Tests', async (t) => {
  await t.test('Test 1 & 2 - Real timestamps, no artificial interpolation', () => {
    const transactions = [
      { createdAt: '2026-01-03T10:00:00Z' },
      { createdAt: '2026-01-04T12:00:00Z' },
      { createdAt: '2026-01-10T14:00:00Z' }
    ];
    const snapshots = selectSnapshotDates(transactions);
    assert.deepStrictEqual(snapshots, [
      '2026-01-03T23:59:59.999Z',
      '2026-01-04T23:59:59.999Z',
      '2026-01-10T23:59:59.999Z'
    ]);
  });

  await t.test('Test 3 - Deduplication', () => {
    const transactions = [
      { createdAt: '2026-01-03T10:00:00Z' },
      { createdAt: '2026-01-03T11:00:00Z' },
      { createdAt: '2026-01-03T12:00:00Z' }
    ];
    const snapshots = selectSnapshotDates(transactions);
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0], '2026-01-03T23:59:59.999Z');
  });

  await t.test('Test 4 - Chronological order', () => {
    const transactions = [
      { createdAt: '2026-01-10T10:00:00Z' },
      { createdAt: '2026-01-01T11:00:00Z' },
      { createdAt: '2026-01-05T12:00:00Z' }
    ];
    const snapshots = selectSnapshotDates(transactions);
    assert.deepStrictEqual(snapshots, [
      '2026-01-01T23:59:59.999Z',
      '2026-01-05T23:59:59.999Z',
      '2026-01-10T23:59:59.999Z'
    ]);
  });

  await t.test('Test 5 - Determinism', () => {
    const transactions = [
      { createdAt: '2026-01-01T10:00:00Z' },
      { createdAt: '2026-01-02T11:00:00Z' },
      { createdAt: '2026-01-03T12:00:00Z' }
    ];
    const snapshots1 = selectSnapshotDates(transactions);
    const snapshots2 = selectSnapshotDates(transactions);
    assert.deepStrictEqual(snapshots1, snapshots2);
  });

  await t.test('Test 6 - Bounded snapshots', () => {
    const transactions = [];
    // Generate 30 distinct days
    for (let i = 1; i <= 30; i++) {
      const day = i.toString().padStart(2, '0');
      transactions.push({ createdAt: `2026-01-${day}T10:00:00Z` });
    }
    const maxSnapshots = 10;
    const snapshots = selectSnapshotDates(transactions, maxSnapshots);
    assert.strictEqual(snapshots.length, maxSnapshots);
    // Ensure first and last are boundaries
    assert.strictEqual(snapshots[0], '2026-01-01T23:59:59.999Z');
    assert.strictEqual(snapshots[maxSnapshots - 1], '2026-01-30T23:59:59.999Z');
  });
});
