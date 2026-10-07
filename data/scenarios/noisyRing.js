const { injectScenario } = require('./utils');

module.exports = function noisyRing(context) {
  injectScenario({
    ...context,
    scenarioId: 'scene_noisy_01',
    family: 'noisy_ring',
    memberCount: 7,
    generateMembers: (members, { faker, makeTxn, makeRefund, refDate }) => {
      const sharedIp = faker.internet.ipv4();
      const sharedDevice = 'dev_' + faker.string.alphanumeric(8);
      const baseDate = faker.date.recent({ days: 60, refDate });
      
      members.forEach((cid, i) => {
        const isCore = i < 3; // some core members are more suspicious
        const txCount = faker.number.int({ min: 5, max: 10 });
        
        for (let j = 0; j < txCount; j++) {
          const ts = new Date(baseDate.getTime() + (j * 86400000 * 2));
          
          // Noise: some normal transactions with personal IPs/devices
          const useShared = faker.datatype.boolean() || isCore;
          
          const tx = makeTxn(cid, {
            ipAddress: useShared ? sharedIp : faker.internet.ipv4(),
            deviceId: useShared ? sharedDevice : 'dev_' + faker.string.alphanumeric(8),
            timestamp: ts
          });
          
          // Only refund some transactions
          if (useShared && faker.datatype.boolean()) {
            makeRefund(tx, {
              timestamp: new Date(ts.getTime() + 86400000),
              complaint: faker.datatype.boolean()
            });
          }
        }
      });
    }
  });
};
