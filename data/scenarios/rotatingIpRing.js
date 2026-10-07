const { injectScenario } = require('./utils');

module.exports = function rotatingIpRing(context) {
  injectScenario({
    ...context,
    scenarioId: 'scene_rotating_01',
    family: 'rotating_ip_ring',
    memberCount: 5,
    generateMembers: (members, { faker, makeTxn, makeRefund }) => {
      const sharedDevice = 'dev_' + faker.string.alphanumeric(8);
      const baseDate = faker.date.recent({ days: 45 });
      
      members.forEach((cid, i) => {
        // IP changes over time (rotation)
        let currentIp = faker.internet.ipv4();
        
        for (let j = 0; j < 5; j++) {
          if (j % 2 === 0) currentIp = faker.internet.ipv4(); // rotate IP frequently
          
          const ts = new Date(baseDate.getTime() + (i * 86400000) + (j * 86400000 * 3));
          
          const tx = makeTxn(cid, {
            ipAddress: currentIp,
            deviceId: sharedDevice, // rely on device linkage instead
            timestamp: ts
          });
          
          makeRefund(tx, {
            timestamp: new Date(ts.getTime() + 86400000),
            reason: 'delivery issue',
            complaint: true
          });
        }
      });
    }
  });
};
