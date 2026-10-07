const { injectScenario } = require('./utils');

module.exports = function slowBurnRing(context) {
  injectScenario({
    ...context,
    scenarioId: 'scene_slowburn_01',
    family: 'slow_burn_ring',
    memberCount: 4,
    generateMembers: (members, { faker, makeTxn, makeRefund, refDate }) => {
      const sharedIp = faker.internet.ipv4();
      const sharedDevice = 'dev_' + faker.string.alphanumeric(8);
      const startDate = faker.date.recent({ days: 150, refDate }); // starts 5 months ago
      
      members.forEach((cid, i) => {
        // Phase 1: Legitimate looking history
        for (let j = 0; j < 3; j++) {
          const ts = new Date(startDate.getTime() + (j * 86400000 * 15)); // spread over 1.5 months
          makeTxn(cid, {
            ipAddress: faker.internet.ipv4(),
            deviceId: 'dev_' + faker.string.alphanumeric(8),
            timestamp: ts
          });
        }
        
        // Phase 2: Start sharing resources but no refunds yet
        const midDate = new Date(startDate.getTime() + (100 * 86400000));
        for (let j = 0; j < 2; j++) {
          const ts = new Date(midDate.getTime() + (j * 86400000 * 5));
          makeTxn(cid, {
            ipAddress: sharedIp,
            deviceId: sharedDevice,
            timestamp: ts
          });
        }

        // Phase 3: Fraud burn (high refund rate on recent transactions)
        const endDate = new Date(startDate.getTime() + (130 * 86400000));
        for (let j = 0; j < 4; j++) {
          const ts = new Date(endDate.getTime() + (j * 86400000 * 2));
          const tx = makeTxn(cid, {
            ipAddress: sharedIp,
            deviceId: sharedDevice,
            timestamp: ts
          });
          
          makeRefund(tx, {
            timestamp: new Date(ts.getTime() + 86400000),
            reason: 'quantity issue',
            complaint: true
          });
        }
      });
    }
  });
};
