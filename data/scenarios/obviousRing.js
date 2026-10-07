const { injectScenario } = require('./utils');

module.exports = function obviousRing(context) {
  injectScenario({
    ...context,
    scenarioId: 'scene_obvious_01',
    family: 'obvious_ring',
    memberCount: 6,
    generateMembers: (members, { faker, makeTxn, makeRefund }) => {
      // 100% shared IP and Device
      const sharedIp = faker.internet.ipv4();
      const sharedDevice = 'dev_' + faker.string.alphanumeric(8);
      
      const baseDate = faker.date.recent({ days: 30 });
      
      members.forEach((cid, i) => {
        // 4 transactions, 4 refunds each
        for (let j = 0; j < 4; j++) {
          const ts = new Date(baseDate.getTime() + (i * 10000) + (j * 86400000));
          const tx = makeTxn(cid, {
            ipAddress: sharedIp,
            deviceId: sharedDevice,
            timestamp: ts
          });
          
          makeRefund(tx, {
            timestamp: new Date(ts.getTime() + 86400000),
            reason: 'damaged',
            complaint: true
          });
        }
      });
    }
  });
};
