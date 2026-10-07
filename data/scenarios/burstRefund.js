const { injectScenario } = require('./utils');

module.exports = function burstRefund(context) {
  injectScenario({
    ...context,
    scenarioId: 'scene_burst_01',
    family: 'burst_refund',
    memberCount: 2,
    generateMembers: (members, { faker, makeTxn, makeRefund, refDate }) => {
      const burstDate = faker.date.recent({ days: 10, refDate });
      
      members.forEach((cid, i) => {
        // Accumulate transactions over a short window
        const txs = [];
        for (let j = 0; j < 12; j++) {
          const ts = new Date(burstDate.getTime() - (86400000 * 15) + (j * 86400000));
          txs.push(makeTxn(cid, {
            ipAddress: faker.internet.ipv4(),
            deviceId: 'dev_' + faker.string.alphanumeric(8),
            timestamp: ts
          }));
        }
        
        // Burst refund on the same day for almost all of them
        const burstRefundDate = new Date(burstDate.getTime() + 86400000);
        txs.slice(0, 10).forEach((tx, k) => {
          makeRefund(tx, {
            // Very concentrated timestamps (minutes apart)
            timestamp: new Date(burstRefundDate.getTime() + (k * 600000)),
            reason: 'wrong item',
            complaint: k % 2 === 0
          });
        });
      });
    }
  });
};
