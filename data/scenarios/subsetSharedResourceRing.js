const { injectScenario } = require('./utils');

/**
 * Unseen scenario family (never used in the development / held-out benchmark).
 *
 * A ring where:
 *   - only a SUBSET of members shares an IP (the other members use unique IPs),
 *   - every member uses a UNIQUE device (no device linkage),
 *   - refund reasons VARY per member and per transaction (no repeated vocabulary,
 *     so the repeatedReason signal stays silent).
 *
 * Expected effect: lower graph density and weaker individual signals than the
 * five original families, so this measures generalization to a partially
 * connected, individually quieter ring.
 */
module.exports = function subsetSharedResourceRing(context) {
  injectScenario({
    ...context,
    scenarioId: 'scene_subset_shared_01',
    family: 'subset_shared_resource',
    memberCount: 8,
    generateMembers: (members, { faker, makeTxn, makeRefund, refDate }) => {
      const sharedIp = faker.internet.ipv4();
      const coreCount = 4;
      const reasons = ['damaged', 'wrong item', 'not as expected', 'quantity issue', 'delivery issue'];
      const baseDate = faker.date.recent({ days: 40, refDate });

      members.forEach((cid, i) => {
        const isCore = i < coreCount;
        const uniqueDevice = 'dev_' + faker.string.alphanumeric(10);
        const personalIp = faker.internet.ipv4();

        for (let j = 0; j < 6; j++) {
          const ts = new Date(baseDate.getTime() + (i * 86400000) + (j * 86400000 * 3));
          const tx = makeTxn(cid, {
            ipAddress: isCore ? sharedIp : personalIp,
            deviceId: uniqueDevice,
            timestamp: ts
          });

          // Core members refund half their transactions (varying reasons);
          // peripheral members refund a single transaction with a unique reason.
          if ((isCore && j % 2 === 1) || (!isCore && j === 0)) {
            makeRefund(tx, {
              timestamp: new Date(ts.getTime() + 86400000),
              reason: reasons[(i + j) % reasons.length],
              complaint: isCore
            });
          }
        }
      });
    }
  });
};